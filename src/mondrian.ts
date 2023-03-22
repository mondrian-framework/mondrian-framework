import { FastifyRequest, fastify, RouteHandler, FastifyReply } from 'fastify'

type Schema = { [k in string]: SchemaField }
type SchemaField = { type: 'number' } | { type: 'string' } | { type: 'object'; schema: Schema | (() => Schema) }

type GetSchema<S> = S extends Schema ? S : S extends () => infer R ? (R extends Schema ? R : never) : never
type SchemaType<T> = GetSchema<T> extends infer S
  ? S extends Schema
    ? {
        [K in keyof S]: S[K] extends {
          type: 'object'
          schema: infer SS
        }
          ? SchemaType<SS>
          : S[K]['type'] extends 'string'
          ? string
          : S[K]['type'] extends 'number'
          ? number
          : never
      }
    : never
  : never
type SchemaTypeOutput<T> = GetSchema<T> extends infer S
  ? S extends Schema
    ? {
        [K in keyof S]?: S[K] extends {
          type: 'object'
          schema: infer SS
        }
          ? SchemaTypeOutput<SS>
          : S[K]['type'] extends 'string'
          ? string
          : S[K]['type'] extends 'number'
          ? number
          : never
      }
    : never
  : never
type Projection<T> = GetSchema<T> extends infer S
  ? S extends Schema
    ? {
        [K in keyof S]?: S[K] extends { type: 'object'; schema: infer SS } ? Projection<SS> : true
      }
    : never
  : never
type Types = Record<string, Schema | (() => Schema)>
type Operations = Record<string, Operation>

export function types<const T extends Types>(types: T): T {
  return types
}

export function type<const S extends Schema>(schema: S): S {
  return schema
}

type Operation = {
  input: Schema | (() => Schema)
  output: Schema | (() => Schema)
  type: 'mutation' | 'query' | 'stream'
  options?: {
    rest?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      path?: string
      inputFrom?: 'body' | 'params' | 'custom'
    }
    graphql?: {
      name?: string
      package?: string
    }
  }
}

export function operation<O extends Operation>(operation: O): O {
  return operation
}

export function operations<O extends Operations>(operations: O): O {
  return operations
}

type ModuleArgs<T extends Types, O extends Operations, Context> = {
  name: string
  types: T
  operations: O
  context: (req: FastifyRequest) => Promise<Context>
  resolvers: {
    [K in keyof O]: {
      f: (args: {
        input: SchemaType<O[K]['input']>
        fields: Projection<O[K]['output']>
        context: Context
      }) => Promise<SchemaTypeOutput<O[K]['output']>>
    } & (O[K]['options'] extends { rest: { inputFrom: 'custom' } }
      ? {
          rest: {
            input: (req: FastifyRequest) => Promise<SchemaType<O[K]['input']>>
          }
        }
      : {})
  }
}
type ModuleOptions = {
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

class Module<const T extends Types, const O extends Operations, const Context> {
  private args: ModuleArgs<T, O, Context>

  constructor(args: ModuleArgs<T, O, Context>) {
    this.args = args
  }

  public async start(
    opts: ModuleOptions,
  ): Promise<{ address: string; opts: ModuleOptions; args: ModuleArgs<T, O, Context> }> {
    const server = fastify()
    for (const [name, operation] of Object.entries(this.args.operations)) {
      const path = `${opts.http?.prefix}${operation.options?.rest?.path ?? `/${name}`}`
      const method = operation.options?.rest?.method ?? (operation.type === 'query' ? 'GET' : 'POST')
      if (method === 'GET') {
        server.get(path, (request, reply) => elabFastifyRestRequest({ request, reply, name, args: this.args }))
      } else if (method === 'POST') {
        server.post(path, (request, reply) => elabFastifyRestRequest({ request, reply, name, args: this.args }))
      }
    }
    if (opts.sanbox?.enabled) {
      server.get(opts.sanbox?.path ?? '/', async (request, reply) => {
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
      server.get(`/api`, async (request, reply) => { return 'OPENAPI / SWAGGER'})
      server.get(`/graphql`, async (request, reply) => { return 'GRAPHQL SANDBOX'})
    }
    const address = await server.listen({ port: opts.port ?? 3000 })
    return { address, opts, args: this.args }
  }
}

async function elabFastifyRestRequest<T extends Types, O extends Operations, Context>({
  request,
  reply,
  name,
  args,
}: {
  request: FastifyRequest
  reply: FastifyReply
  name: string
  args: ModuleArgs<T, O, Context>
}): Promise<unknown> {
  const operation = args.operations[name]
  const resolver = args.resolvers[name]
  const inputFrom = operation.options?.rest?.inputFrom ?? (request.method === 'GET' ? 'params' : 'body')
  const input =
    inputFrom === 'custom'
      ? await (resolver as any).rest.input(request)
      : inputFrom === 'body'
      ? request.body
      : request.params
  const context = await args.context(request)
  const result = await resolver.f({
    fields: {} as any,
    context,
    input,
  })
  return result
}
export function module<const T extends Types, const O extends Operations, const Context>(
  args: ModuleArgs<T, O, Context>,
): Module<T, O, Context> {
  return new Module(args)
}
