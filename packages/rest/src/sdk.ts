import { Infer, InferProjection, LazyType, Project, Types, decode, encode } from '@mondrian/model'
import { Functions, Module } from '@mondrian/module'
import { ModuleRestApi } from './server'
import { encodeQueryObject } from './utils'

type SDK<T extends Types, F extends Functions<keyof T extends string ? keyof T : never>> = {
  [K in keyof F]: Infer<T[F[K]['input']]> extends infer Input
    ? InferProjection<T[F[K]['output']]> extends infer Fields
      ? SdkResolver<Input, Fields, T[F[K]['output']]>
      : never
    : never
}

type SdkResolver<Input, Fields, OutputType extends LazyType> = <const F extends Fields>(args: {
  input: Input
  headers?: Record<string, string | string[] | undefined>
  fields?: F
}) => Promise<Project<F, OutputType>>

export function createRestSdk<
  const T extends Types,
  const F extends Functions<keyof T extends string ? keyof T : never>,
>({
  module,
  defaultHeaders,
  rest,
  endpoint,
}: {
  module: Module<T, F> //TODO: remove impl
  rest: ModuleRestApi<F>
  defaultHeaders?: Record<string, string>
  endpoint: string
}): SDK<T, F> {
  const functions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const specification = rest.api[functionName]
      const resolver = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
        const url = `${endpoint}/api/${specification.path ?? functionName}`
        const encodedInput = encode(module.types[functionBody.input], input)
        const realUrl =
          specification.method === 'GET' || specification.method === 'DELETE'
            ? `${url}?${encodeQueryObject(encodedInput, 'input')}`
            : url
        const response = await fetch(realUrl, {
          headers: { 'content-type': 'application/json', ...defaultHeaders, ...headers }, //TODO: fields
          method: specification.method,
          body:
            specification.method !== 'GET' && specification.method !== 'DELETE'
              ? JSON.stringify(encodedInput)
              : undefined,
        })
        const operationId = response.headers.get('operation-id')
        if (response.status === 200) {
          const json = await response.json()
          const result = decode(module.types[functionBody.output], json)
          if (result.pass) {
            return result.value
          }
          throw new Error(JSON.stringify(result.errors))
        }
        console.log(`Operation failed: ${operationId}`)
        throw new Error(await response.text())
      }
      return [functionName, resolver]
    }),
  )

  return functions as SDK<T, F>
}
/*
export function createSdk<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : never>>({
  module,
  defaultHeaders,
  ...args
}:
  | {
      module: Module<T, F>
      defaultHeaders?: Record<string, string>
      configuration: Infer<C>
    }
  | {
      module: ModuleDefinition<T, O, C>
      defaultHeaders?: Record<string, string>
      endpoint: string
    }): SDK<T, O> {
    const queries = Object.fromEntries(
      Object.entries(module.resolvers.queries).map(([query, body]) => {
        const resolver = body.f
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const context = await module.context({ headers: { ...defaultHeaders, ...headers } })
          return resolver({ input, fields, context, configuration: args.configuration })
        }
        return [query, wrapper]
      }),
    )
    const mutations = Object.fromEntries(
      Object.entries(module.resolvers.mutations).map(([mutation, body]) => {
        const resolver = body.f
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const context = await module.context({ headers: { ...defaultHeaders, ...headers } })
          return resolver({ input, fields, context, configuration: args.configuration })
        }
        return [mutation, wrapper]
      }),
    )
    return {
      query: queries,
      mutation: mutations,
    } as SDK<T, O>
}
*/
