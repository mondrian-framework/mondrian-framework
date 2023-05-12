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
  api,
  endpoint,
}: {
  module: Module<T, F>
  api: ModuleRestApi<F>
  defaultHeaders?: Record<string, string>
  endpoint: string
}): SDK<T, F> {
  const functions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const specification = api.functions[functionName]
      const resolver = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
        const url = `${endpoint}/api/${specification.path ?? functionName}`
        const encodedInput = encode(module.types[functionBody.input], input)
        const realUrl =
          specification.method === 'GET' || specification.method === 'DELETE'
            ? `${url}?${encodeQueryObject(encodedInput, 'input')}`
            : url
        const fieldsHeader = fields != null ? { fields: JSON.stringify(fields) } : {}
        const response = await fetch(realUrl, {
          headers: { 'content-type': 'application/json', ...defaultHeaders, ...headers, ...fieldsHeader },
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
