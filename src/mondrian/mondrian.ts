import { FastifyRequest, fastify, FastifyReply } from 'fastify'
import { PartialDeep, lazyToType } from './utils'
import { createYoga } from 'graphql-yoga'
import { buildGraphqlSchema } from './graphl-builder'
import { Infer, Projection, Types } from './type-system'
import { createGRPCServer } from './grpc'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import { fastifyStatic } from '@fastify/static'
import path from 'path'
import fs from 'fs'

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
    logger: false,
  })
  server.register(fastifyStatic, {
    root: getAbsoluteFSPath(),
    prefix: '/api/doc', // optional: default '/'
  })
  const indexContent = fs
    .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
    .toString()
    .replace('https://petstore.swagger.io/v2/swagger.json', 'http://127.0.0.1:4000/api/doc/schema.json')
  server.get('/api/doc/swagger-initializer.js', (req, res) => res.send(indexContent))
  server.get('/api/doc', (req, res) => {
    res.redirect('/api/doc/index.html')
  })
  server.get('/api/doc/schema.json', () => {
    return {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'Swagger Petstore',
        license: {
          name: 'MIT',
        },
      },
      servers: [
        {
          url: 'http://127.0.0.1:4000/api',
        },
      ],
      paths: {
        '/pets': {
          get: {
            summary: 'List all pets',
            operationId: 'listPets',
            tags: ['pets'],
            parameters: [
              {
                name: 'limit',
                in: 'query',
                description: 'How many items to return at one time (max 100)',
                required: false,
                schema: {
                  type: 'integer',
                  maximum: 100,
                  format: 'int32',
                },
              },
            ],
            responses: {
              '200': {
                description: 'A paged array of pets',
                headers: {
                  'x-next': {
                    description: 'A link to the next page of responses',
                    schema: {
                      type: 'string',
                    },
                  },
                },
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Pets',
                    },
                  },
                },
              },
              default: {
                description: 'unexpected error',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Error',
                    },
                  },
                },
              },
            },
          },
          post: {
            summary: 'Create a pet',
            operationId: 'createPets',
            tags: ['pets'],
            responses: {
              '201': {
                description: 'Null response',
              },
              default: {
                description: 'unexpected error',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Error',
                    },
                  },
                },
              },
            },
          },
        },
        '/pets/{petId}': {
          get: {
            summary: 'Info for a specific pet',
            operationId: 'showPetById',
            tags: ['pets'],
            parameters: [
              {
                name: 'petId',
                in: 'path',
                required: true,
                description: 'The id of the pet to retrieve',
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Expected response to a valid request',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Pet',
                    },
                  },
                },
              },
              default: {
                description: 'unexpected error',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Error',
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: {
                type: 'integer',
                format: 'int64',
              },
              name: {
                type: 'string',
              },
              tag: {
                type: 'string',
              },
            },
          },
          Pets: {
            type: 'array',
            maxItems: 100,
            items: {
              $ref: '#/components/schemas/Pet',
            },
          },
          Error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'integer',
                format: 'int32',
              },
              message: {
                type: 'string',
              },
            },
          },
        },
      },
    }
  })

  /*
  await server.register(fastifySwaggerUI, {
    routePrefix: '/api/doc',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next()
      },
      preHandler: function (request, reply, next) {
        next()
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject
    },
    transformSpecificationClone: true,
  })*/

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
    logging: false,
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
            <li> <a href="${address}/api/doc">REST API DOCUMENTATION</a> </li>
            <li> <a href="${address}/graphql">GRAPHQL API</a> </li>
            </list>
          </body>
        </html>
        `
    })
  }
  const address = await server.listen({ port: options.port ?? 3000 })

  //gRPC
  await createGRPCServer({ module, options })

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
  const inputType = lazyToType(operation.types[operation.input])
  if ((inputType.kind === 'string' || inputType.kind === 'custom') && inputFrom !== 'custom') {
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
