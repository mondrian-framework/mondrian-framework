import { FastifyRequest, fastify, FastifyReply } from 'fastify'
import { PartialDeep } from './utils'

type Type =
  | { kind: 'object'; type: ObjectType }
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'date' }
  | { kind: 'array-decorator'; type: LazyType }
  | { kind: 'optional-decorator'; type: LazyType }
type LazyType = Type | (() => Type)
type ObjectType = { [K in string]: LazyType }
type Types = Record<string, LazyType>
type Operations = Record<string, Operation>

export function types<const T extends Types>(types: T): T {
  return types
}
export function object<const T extends ObjectType>(type: T): { kind: 'object'; type: T } {
  return { kind: 'object', type }
}
export function number(): { kind: 'number' } {
  return { kind: 'number' }
}
export function string(): { kind: 'string' } {
  return { kind: 'string' }
}
export function boolean(): { kind: 'boolean' } {
  return { kind: 'boolean' }
}
export function date(): { kind: 'date' } {
  return { kind: 'date' }
}
export function array<const T extends LazyType>(type: T): { kind: 'array-decorator'; type: T } {
  return { kind: 'array-decorator', type }
}
export function optional<const T extends LazyType>(type: T): { kind: 'optional-decorator'; type: T } {
  return { kind: 'optional-decorator', type }
}

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

export type Infer<T extends LazyType> = T extends () => infer LT ? InferType<LT> : InferType<T>

type OptionalKeys<T extends ObjectType> = {
  [K in keyof T]: T[K] extends { kind: 'optional-decorator'; type: unknown } ? K : never
}[keyof T]
type NonOptionalKeys<T extends ObjectType> = {
  [K in keyof T]: T[K] extends { kind: 'optional-decorator'; type: unknown } ? never : K
}[keyof T]

type InferType<T> = T extends Type
  ? T extends { kind: 'array-decorator'; type: infer ST }
    ? ST extends LazyType
      ? Infer<ST>[]
      : never
    : T extends { kind: 'optional-decorator'; type: infer ST }
    ? ST extends LazyType
      ? Infer<ST> | undefined
      : never
    : T extends { kind: 'string' }
    ? string
    : T extends { kind: 'number' }
    ? number
    : T extends { kind: 'boolean' }
    ? boolean
    : T extends { kind: 'date' }
    ? Date
    : T extends { kind: 'object'; type: infer ST }
    ? ST extends ObjectType
      ? Expand<
          {
            [K in NonOptionalKeys<ST>]: Infer<ST[K]>
          } & {
            [K in OptionalKeys<ST>]?: Infer<ST[K]>
          }
        >
      : never
    : never
  : never

type Projection<T> = T extends Date
  ? true | undefined
  : T extends (infer E)[]
  ? Projection<E>
  : T extends object
  ? {
      [K in keyof T]?: Projection<T[K]> | true
    }
  : true | undefined

type Operation = {
  input: LazyType
  output: LazyType
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
    [K in keyof O]: Infer<O[K]['input']> extends infer Input
      ? Infer<O[K]['output']> extends infer Output
        ? {
            f: (args: { input: Input; fields: Projection<Output> | undefined; context: Context }) => Promise<PartialDeep<Output>>
          } & (O[K]['options'] extends { rest: { inputFrom: 'custom' } }
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
      server.get(`/api`, async (request, reply) => {
        return 'OPENAPI / SWAGGER'
      })
      server.get(`/graphql`, async (request, reply) => {
        return 'GRAPHQL SANDBOX'
      })
    }
    const address = await server.listen({ port: opts.port ?? 3000 })
    return { address, opts, args: this.args }
  }
}

function lazyToType(t: LazyType): Type {
  if(typeof t === 'function') {
    return t()
  }
  return t
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
  let input =
    inputFrom === 'custom'
      ? await (resolver as any).rest.input(request)
      : inputFrom === 'body'
      ? request.body
      : request.params
  if(lazyToType(operation.input).kind === 'string' && inputFrom !== 'custom') {
    input = Object.values(input)[0]
  }
  const context = await args.context(request)
  const result = await (resolver.f as any)({
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
