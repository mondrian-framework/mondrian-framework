import { FastifyRequest, fastify, FastifyReply } from 'fastify'
import { createYoga } from 'graphql-yoga'
import { buildGraphqlSchema } from './graphl-builder'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import { fastifyStatic } from '@fastify/static'
import path from 'path'
import fs from 'fs'
import { attachRestMethods, openapiSpecification } from './openapi'
import { Infer, InferProjection, InferReturn, LazyType, Types } from '@mondrian/model'

export type Operations<T extends Types> = Record<OperationNature, Record<string, Operation<T, string, string>>>

export type OperationNature = 'mutations' | 'queries'
export type Operation<T extends Types, I extends keyof T, O extends keyof T> = {
  types: T
  input: I
  output: O
  options?: {
    rest?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      path?: string
    }
    graphql?: {
      name?: string
      inputName?: string
      package?: string
    }
  }
}

//function
export function operation<const T extends Types, const I extends keyof T, const O extends keyof T>(
  operation: Operation<T, I, O>,
): Operation<T, I, O> {
  return operation
}

export function operations<const T extends Types, const O extends Operations<T>>(operations: O): O {
  return operations
}

type MondrianRequest = {
  headers: Record<string, string | string[] | undefined>
}

export function context<const T>(f: (req: MondrianRequest) => Promise<T>): (req: MondrianRequest) => Promise<T> {
  return f
}

export type ModuleDefinition<T extends Types, O extends Operations<T>, C extends LazyType> = {
  name: string
  types: T
  operations: O
  configuration: C
}
export type ResolverF<Input, Output, Fields, Configuration, Context> = (args: {
  input: Input
  fields: Fields | undefined
  context: Context
  operationId: string
  configuration: Configuration
}) => Promise<Output>

export type GenericModule = {
  name: string
  types: Types
  operations: Record<OperationNature, Record<string, Operation<Types, string, string>>>
  context: (req: MondrianRequest) => Promise<unknown>
  resolvers: {
    queries: Record<
      string,
      {
        f: ResolverF<unknown, unknown, unknown, unknown, any>
      }
    >
    mutations: Record<
      string,
      {
        f: ResolverF<unknown, unknown, unknown, unknown, any>
      }
    >
  }
}
export type Module<
  T extends Types,
  O extends Operations<T>,
  C extends LazyType,
  Context,
> = Infer<C> extends infer Configuration
  ? ModuleDefinition<T, O, C> & {
      context: (req: MondrianRequest) => Promise<Context>
      resolvers: {
        queries: {
          [K in keyof O['queries']]: Infer<T[O['queries'][K]['input']]> extends infer Input
            ? InferReturn<T[O['queries'][K]['output']]> extends infer Output
              ? InferProjection<T[O['queries'][K]['output']]> extends infer Fields
                ? {
                    f: ResolverF<Input, Output, Fields, Configuration, Context>
                  }
                : never
              : never
            : never
        }
        mutations: {
          [K in keyof O['mutations']]: Infer<T[O['mutations'][K]['input']]> extends infer Input
            ? InferReturn<T[O['mutations'][K]['output']]> extends infer Output
              ? InferProjection<T[O['mutations'][K]['output']]> extends infer Fields
                ? {
                    f: ResolverF<Input, Output, Fields, Configuration, Context>
                  }
                : never
              : never
            : never
        }
      }
    }
  : never
export type ModuleRunnerOptions = {
  port?: number
  tracing?: boolean
  introspection?:
    | boolean
    | {
        path?: string
      }
  diagnostic?: boolean
  healthcheck?:
    | boolean
    | {
        path?: string
        healty?: () => Promise<boolean> | boolean
      }
  http?: {
    errorHandler?: (args: {
      error: unknown
      operation: Operation<Types, string, string>
      request: FastifyRequest
      reply: FastifyReply
      operationId: string
    }) => Promise<{ response?: unknown; statusCode?: number } | void>
    logger?: boolean
  }
  graphql?: {
    errorHandler?: (args: {
      error: unknown
      operation: Operation<Types, string, string>
      operationId: string
    }) => Promise<{ error?: unknown } | void>
    logger?: boolean
  }
  grpc?: {
    enabled?: boolean
    port?: number
    reflection?: boolean
  }
  validation?: {
    input?: boolean
    output?: boolean
  }
}

export function module<const T extends Types, const O extends Operations<T>, const C extends LazyType, const Context>(
  module: Module<T, O, C, Context>,
): Module<T, O, C, Context> {
  return module
}

export function moduleDefinition<const T extends Types, const O extends Operations<T>, const C extends LazyType>(
  module: ModuleDefinition<T, O, C>,
): ModuleDefinition<T, O, C> {
  return module
}

export async function start<
  const T extends Types,
  const O extends Operations<T>,
  const C extends LazyType,
  const Context,
>({
  module,
  configuration,
  options,
}: {
  module: Module<T, O, C, Context>
  configuration: Infer<C>
  options: ModuleRunnerOptions
}): Promise<{
  address: string
  ms: number
  instance: { close: () => Promise<void> }
}> {
  const startDate = new Date()
  //if (options.tracing) { //TODO
  //  useTracing()
  //}
  const server = fastify()

  //DIAGNOSTIC
  if (options.diagnostic) {
    server.get(`/diagnostic`, (req, reply) => {
      reply.header('content-type', 'application/json')
      return JSON.stringify({ configuration }, null, 2)
    })
  }
  //HEALTHCHECK
  const healthcheckUrl = (typeof options.healthcheck === 'object' ? options.healthcheck.path : null) ?? `/healthcheck`
  if (options.healthcheck) {
    server.get(healthcheckUrl, async (req, reply) => {
      const healty =
        typeof options.healthcheck === 'object'
          ? options.healthcheck.healty
            ? await options.healthcheck.healty()
            : true
          : true
      if (!healty) {
        reply.status(418)
      }
      return { healty }
    })
  }

  //REST
  const httpPrefix = '/api'
  if (options.http) {
    if (options.introspection) {
      server.register(fastifyStatic, {
        root: getAbsoluteFSPath(),
        prefix: `${httpPrefix}/doc`,
      })
      const indexContent = fs
        .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
        .toString()
        .replace('https://petstore.swagger.io/v2/swagger.json', `http://127.0.0.1:4000${httpPrefix}/doc/schema.json`)
      server.get(`${httpPrefix}/doc/swagger-initializer.js`, (req, res) => res.send(indexContent))
      server.get(`${httpPrefix}/doc`, (req, res) => {
        res.redirect(`${httpPrefix}/doc/index.html`)
      })
    }
    const spec = openapiSpecification({ module, options })
    server.get(`${httpPrefix}/doc/schema.json`, () => spec)
    attachRestMethods({ module, options, server, configuration })
  }
  //GRAPHQL
  if (options.graphql) {
    const yoga = createYoga<{ fastify: { request: FastifyRequest; reply: FastifyReply } }>({
      schema: buildGraphqlSchema({ module, options, configuration }),
      plugins: options.introspection ? [] : [], //TODO
      logging: false,
    })
    server.route({
      url: '/graphql',
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (request, reply) => {
        // Second parameter adds Fastify's `req` and `reply` to the GraphQL Context
        const response = await yoga.handleNodeRequest(request, { fastify: { request, reply } })
        response.headers.forEach((value, key) => {
          reply.header(key, value)
        })
        reply.status(response.status)
        reply.send(response.body)
        return reply
      },
    })
  }
  if (options.introspection) {
    server.get(
      (typeof options.introspection === 'object' ? options.introspection?.path : null) ?? '/',
      async (request, reply) => {
        reply.type('text/html')
        return `<html> <head> <style>body, html{background-color: #f6f6f6;}#painting{height: 400px; width: 400px; background: #fff4db; margin-top: 30px; margin: auto; box-shadow: 10px 10px 0px #8d8d8d;}/* Box IDs */ #top-row{height: 290px;}#big-box{width: 290px; height: 290px;}#bottom-left-box{width: 100px; height: 100px;}#bottom-right-column{height: 100px; width: 40px;}#bottom-middle-box{height: 100px; width: 240px;}/* Divider IDs */ #divider-1{height: 290px; width: 10px;}#divider-2{height: 10px; width: 100px;}#divider-3{height: 10px; width: 400px;}#divider-4{height: 100px; width: 10px;}#divider-5{height: 10px; width: 50px;}#divider-6{height: 100px; width: 10px;}/* Box Classes */ .right{float: right;}.medium-box{width: 100px; height: 140px;}.small-box{width: 50px; height: 45px;}/* Color Classes */ .red{background-color: red;}.blue{background-color: blue;}.yellow{background-color: yellow;}.black{background-color: black;}</style> </head> <body> <a href="${address}${httpPrefix}/doc">REST API</a> </br> <a href="${address}${'/graphql'}">GRAPHQL API</a> <div id="painting"> <div id="top-row"> <div id="big-box" class="red right"></div><div id="divider-1" class="black right"></div><div id="top-left-column" class="right"> <div class="medium-box"></div><div id="divider-2" class="black"></div><div class="medium-box"></div></div></div><div class="black right" id="divider-3" ></div><div id="bottom-row"> <div id="bottom-right-column" class="right"> <div class="small-box blue right"></div><div id="divider-5" class="black right"></div><div class="small-box yellow right"></div></div><div id="divider-6" class="right black"></div><div id="bottom-middle-box" class="right"></div><div id="divider-4" class="black right"></div><div id="bottom-left-box" class="blue right"></div></div></div></body> </html>`
      },
    )
  }
  const address = await server.listen({ port: options.port ?? 3000 })

  return {
    address,
    ms: new Date().getTime() - startDate.getTime(),
    instance: {
      async close() {
        await server.close()
      },
    },
  }
}
