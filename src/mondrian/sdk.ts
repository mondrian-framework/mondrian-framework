import { decode } from './decoder'
import { Operations, Module, ModuleDefinition } from './mondrian'
import { Infer, Projection, Types, encode } from './type-system'

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
      Object.entries(module.operations.queries).map(([query, body]) => {
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const url = `${args.endpoint}/`
          const response = await fetch(url, { headers: defaultHeaders })
          const result = decode(module.types[query], response.body)
          return result
        }
        return [query, wrapper]
      }),
    )
    const mutations = Object.fromEntries(
      Object.entries(module.operations.mutations).map(([mutation, body]) => {
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const url = `${args.endpoint}/api/${body.options?.rest?.path ?? mutation}`
          const response = await fetch(url, {
            headers: { ...defaultHeaders, 'content-type': 'application/json' },
            method: body.options?.rest?.method ?? 'post',
            body: JSON.stringify(encode(module.types[body.input], input)),
          })
          const json = await response.json()
          if (response.status === 200) {
            const result = decode(module.types[body.output], json)
            if (result.pass) {
              return result.value
            }
            throw new Error(JSON.stringify(result.errors))
          }
          throw new Error(JSON.stringify(json))
        }
        return [mutation, wrapper]
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
