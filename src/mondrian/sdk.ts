import { decode } from './decoder'
import { encode } from './encoder'
import { Operations, Module, ModuleDefinition, Operation, OperationNature } from './mondrian'
import { Infer, Projection, Types } from './type-system'
import { encodeQueryObject } from './utils'

type SDK<T extends Types, O extends Operations<T>> = {
  query: {
    [K in keyof O['queries']]: Infer<T[O['queries'][K]['input']]> extends infer Input
      ? Infer<T[O['queries'][K]['output']]> extends infer Output
        ? SdkResolver<Input, Output>
        : never
      : never
  }
  mutation: {
    [K in keyof O['mutations']]: Infer<T[O['mutations'][K]['input']]> extends infer Input
      ? Infer<T[O['mutations'][K]['output']]> extends infer Output
        ? SdkResolver<Input, Output>
        : never
      : never
  }
}

type SdkResolver<Input, Output> = <const P extends Projection<Output>>(args: {
  input: Input
  headers?: Record<string, string | string[] | undefined>
  fields?: P
}) => Promise<Project<Output, P>>

type Project<T, P> = T extends object
  ? P extends object
    ? {
        //@ts-ignore
        [K in keyof P]: Project<T[K], P[K]>
      }
    : T
  : T

export function sdk<const T extends Types, const O extends Operations<T>>({
  module,
  defaultHeaders,
  ...args
}:
  | {
      module: Module<T, O, any>
      defaultHeaders?: Record<string, string>
    }
  | {
      module: ModuleDefinition<T, O>
      defaultHeaders?: Record<string, string>
      endpoint: string
    }): SDK<T, O> {
  if ('endpoint' in args) {
    const queries = Object.fromEntries(
      Object.entries(module.operations.queries).map(([operationName, operation]) => {
        const resolver = handleRemoteCall({
          module,
          defaultHeaders,
          endpoint: args.endpoint,
          operation,
          operationName,
          operationNature: 'queries',
        })
        return [operationName, resolver]
      }),
    )
    const mutations = Object.fromEntries(
      Object.entries(module.operations.mutations).map(([operationName, operation]) => {
        const resolver = handleRemoteCall({
          module,
          defaultHeaders,
          endpoint: args.endpoint,
          operation,
          operationName,
          operationNature: 'mutations',
        })
        return [operationName, resolver]
      }),
    )
    return {
      query: queries,
      mutation: mutations,
    } as SDK<T, O>
  } else if ('resolvers' in module) {
    const queries = Object.fromEntries(
      Object.entries(module.resolvers.queries).map(([query, body]) => {
        const resolver = body.f
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const context = await module.context({ headers: { ...defaultHeaders, ...headers } })
          return resolver({ input, fields, context })
        }
        return [query, wrapper]
      }),
    )
    const mutations = Object.fromEntries(
      Object.entries(module.resolvers.mutations).map(([mutation, body]) => {
        const resolver = body.f
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const context = await module.context({ headers: { ...defaultHeaders, ...headers } })
          return resolver({ input, fields, context })
        }
        return [mutation, wrapper]
      }),
    )
    return {
      query: queries,
      mutation: mutations,
    } as SDK<T, O>
  }
  throw new Error('Unrechable')
}

function handleRemoteCall<const T extends Types, const O extends Operations<T>>({
  module,
  defaultHeaders,
  endpoint,
  operationName,
  operation,
  operationNature,
}: {
  module: ModuleDefinition<T, O>
  defaultHeaders: Record<string, string> | undefined
  endpoint: string
  operationName: string
  operation: Operation<T, string, string>
  operationNature: OperationNature
}) {
  const resolver = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
    const url = `${endpoint}/api/${operation.options?.rest?.path ?? operationName}`
    const method = operation.options?.rest?.method ?? (operationNature === 'mutations' ? 'POST' : 'GET')
    const encodedInput = encode(module.types[operation.input], input)
    const realUrl = method === 'GET' || method === 'DELETE' ? `${url}?${encodeQueryObject(encodedInput, 'input')}` : url
    const response = await fetch(realUrl, {
      headers: { 'content-type': 'application/json', ...defaultHeaders },
      method: method,
      body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(encodedInput) : undefined,
    })
    const json = await response.json()
    if (response.status === 200) {
      const result = decode(module.types[operation.output], json)
      if (result.pass) {
        return result.value
      }
      throw new Error(JSON.stringify(result.errors))
    }
    throw new Error(JSON.stringify(json))
  }
  return resolver
}
