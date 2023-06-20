import { RestApi } from './api'
import { encodeQueryObject } from './utils'
import { Infer, InferProjection, LazyType, Project, Types, decodeAndValidate, encode } from '@mondrian-framework/model'
import { Functions, Module } from '@mondrian-framework/module'

type SDK<F extends Functions, API extends RestApi<F>> = {
  [K in keyof F & keyof API['functions']]: Infer<F[K]['input']> extends infer Input
    ? InferProjection<F[K]['output']> extends infer Projection
      ? SdkResolver<Input, Projection, F[K]['output']>
      : never
    : never
}

type SdkResolver<Input, Projection, OutputType extends LazyType> = <const F extends Projection>(args: {
  input: Input
  headers?: Record<string, string | string[] | undefined>
  projection?: F
}) => Promise<Project<F, OutputType>>

export function createRestSdk<const F extends Functions, const API extends RestApi<F>>({
  module,
  defaultHeaders,
  api,
  endpoint,
}: {
  module: Module<F, any>
  api: API
  defaultHeaders?: Record<string, string>
  endpoint: string
}): SDK<F, API> {
  const functions = Object.fromEntries(
    Object.entries(module.functions.definitions).flatMap(([functionName, functionBody]) => {
      const specs = api.functions[functionName]
      const specification = Array.isArray(specs) ? specs[0] : specs
      if (!specification) {
        return []
      }
      const resolver = async ({ input, projection, headers }: { input: any; headers?: any; projection: any }) => {
        const url = `${endpoint}/api${specification.path ?? `/${functionName}`}`
        const encodedInput = encode(functionBody.input, input)
        const realUrl =
          specification.method === 'get' || specification.method === 'delete'
            ? `${url}?${encodeQueryObject(encodedInput, specification.inputName ?? 'input')}`
            : url
        const projectionHeader = projection != null ? { projection: JSON.stringify(projection) } : {}
        const response = await fetch(realUrl, {
          headers: { 'content-type': 'application/json', ...defaultHeaders, ...headers, ...projectionHeader },
          method: specification.method,
          body:
            specification.method !== 'get' && specification.method !== 'delete'
              ? JSON.stringify(encodedInput)
              : undefined,
        })
        const operationId = response.headers.get('operation-id')
        if (response.status === 200) {
          const json = await response.json()
          const result = decodeAndValidate(functionBody.output, json)
          if (!result.success) {
            throw new Error(JSON.stringify(result.errors))
          }
          return result.value
        }
        console.log(`Operation failed: ${operationId}`)
        throw new Error(await response.text())
      }
      return [[functionName, resolver]]
    }),
  )

  return functions as SDK<F, API>
}
