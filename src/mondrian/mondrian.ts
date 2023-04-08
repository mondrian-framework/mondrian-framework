import { FastifyRequest, fastify, FastifyReply } from 'fastify'
import { PartialDeep, lazyToType } from './utils'
import { createSchema, createYoga } from 'graphql-yoga'
import { buildGraphqlSchema } from './graphl-builder'
import { Infer, Projection, Types } from './type-system'

export type Operations<T extends Types> = Record<OperationNature, Record<string, Operation<T, string, string>>>

type OperationNature = 'mutations' | 'queries'
type Operation<T extends Types, I extends keyof T, O extends keyof T> = {
  types: T
  input: I
  output: O
  options?: {
    rest?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      path?: string
      inputFrom?: 'body' | 'params' | 'custom'
    }
    graphql?: {
      name?: string
      inputName?: string
      package?: string
    }
  }
}

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

export type ModuleDefinition<T extends Types, O extends Operations<T>> = {
  name: string
  types: T
  operations: O
}
export type ResolverF<Input, Output, Context> = (args: {
  input: Input
  fields: Projection<Output> | undefined
  context: Context
}) => Promise<PartialDeep<Output>>
export type Module<T extends Types, O extends Operations<T>, Context> = ModuleDefinition<T, O> & {
  context: (req: MondrianRequest) => Promise<Context>
  resolvers: {
    queries: {
      [K in keyof O['queries']]: Infer<T[O['queries'][K]['input']]> extends infer Input
        ? Infer<T[O['queries'][K]['output']]> extends infer Output
          ? {
              f: ResolverF<Input, Output, Context>
            } & (O['queries'][K]['options'] extends { rest: { inputFrom: 'custom' } }
              ? {
                  rest: {
                    input: (req: FastifyRequest) => Promise<Input>
                  }
                }
              : {})
          : never
        : never
    }
    mutations: {
      [K in keyof O['mutations']]: Infer<T[O['mutations'][K]['input']]> extends infer Input
        ? Infer<T[O['mutations'][K]['output']]> extends infer Output
          ? {
              f: (args: {
                input: Input
                fields: Projection<Output> | undefined
                context: Context
              }) => Promise<PartialDeep<Output>>
            } & (O['mutations'][K]['options'] extends { rest: { inputFrom: 'custom' } }
              ? {
                  rest: {
                    input: (req: FastifyRequest) => Promise<Input>
                  }
                }
              : {})
          : never
        : never
    }
  }
}
export type ModuleRunnerOptions = {
  port?: number
  sanbox?: {
    enabled?: boolean
    path?: string
  }
  http?: {
    enabled: boolean
    prefix: string
  }
  graphql?: {
    enabled?: boolean
    path?: string
  }
  validation?: {
    input?: boolean
    output?: boolean
  }
}

export function module<const T extends Types, const O extends Operations<T>, const Context>(
  module: Module<T, O, Context>,
): Module<T, O, Context> {
  return module
}

export function moduleDefinition<const T extends Types, const O extends Operations<T>>(
  module: ModuleDefinition<T, O>,
): ModuleDefinition<T, O> {
  return module
}

export async function start<const T extends Types, const O extends Operations<T>, const Context>(
  module: Module<T, O, Context>,
  options: ModuleRunnerOptions,
): Promise<{ address: string; options: ModuleRunnerOptions; module: Module<T, O, Context> }> {
  const server = fastify({
    logger: false
  })

  //REST
  for (const [opt, operations] of Object.entries(module.operations)) {
    const operationNature = opt as OperationNature
    for (const [operationName, operation] of Object.entries(operations)) {
      const path = `${options.http?.prefix}${operation.options?.rest?.path ?? `/${operationName}`}`
      const method = operation.options?.rest?.method ?? (operationNature === 'queries' ? 'GET' : 'POST')
      if (method === 'GET') {
        server.get(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationType: operationNature, module }),
        )
      } else if (method === 'POST') {
        server.post(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationType: operationNature, module }),
        )
      }
    }
    /*server.get(`/api`, async (request, reply) => {
      return 'OPENAPI / SWAGGER'
    })*/
  }

  //GRAPHQL
  const yoga = createYoga<{ req: FastifyRequest; reply: FastifyReply }>({
    schema: buildGraphqlSchema({ module, options }),
    context: ({ req }) => {
      return module.context({ headers: req.headers })
    },
    logging: false
  })
  server.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      // Second parameter adds Fastify's `req` and `reply` to the GraphQL Context
      const response = await yoga.handleNodeRequest(req, { req, reply })
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      reply.status(response.status)
      reply.send(response.body)
      return reply
    },
  })
  if (options.sanbox?.enabled) {
    server.get(options.sanbox?.path ?? '/', async (request, reply) => {
      reply.type('text/html')
      return `
        <html>
          <body>
            <list>
            <li> <a href="${address}/api">REST API</a> </li>
            <li> <a href="${address}/graphql">GRAPHQL API</a> </li>
            </list>
          </body>
        </html>
        `
    })
  }
  const address = await server.listen({ port: options.port ?? 3000 })
  return { address, options, module }
}

async function elabFastifyRestRequest<T extends Types, O extends Operations<T>, Context>({
  request,
  reply,
  operationName,
  module,
  operationType,
}: {
  request: FastifyRequest
  reply: FastifyReply
  operationName: string
  operationType: OperationNature
  module: Module<T, O, Context>
}): Promise<unknown> {
  const operation = module.operations[operationType][operationName]
  const resolver = module.resolvers[operationType][operationName]
  const inputFrom = operation.options?.rest?.inputFrom ?? (request.method === 'GET' ? 'params' : 'body')
  let input =
    inputFrom === 'custom'
      ? await (resolver as any).rest.input(request)
      : inputFrom === 'body'
      ? request.body
      : request.params
  if (lazyToType(operation.types[operation.input]).kind === 'string' && inputFrom !== 'custom') {
    input = Object.values(input)[0]
  }
  const context = await module.context({ headers: request.headers })
  const result = await (resolver.f as any)({
    fields: {} as any,
    context,
    input,
  })
  return result
}
