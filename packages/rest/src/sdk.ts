import { RestApi } from './api'
import { encodeQueryObject } from './utils'
import { decoder, encoder, projection, types } from '@mondrian-framework/model'
import { functions, module, sdk } from '@mondrian-framework/module'

export type Sdk<F extends functions.Functions> = {
  functions: SdkFunctions<F>
  withHeaders: (headers: Record<string, string | string[] | undefined>) => Sdk<F>
}

type SdkFunctions<F extends functions.Functions> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output']>
}

type SdkFunction<InputType extends types.Type, OutputType extends types.Type> = <
  const P extends projection.FromType<OutputType>,
>(
  input: types.Infer<InputType>,
  options?: { projection?: P; headers?: Record<string, string | string[] | undefined> },
) => Promise<sdk.Project<OutputType, P>>

export function build<const Fs extends functions.Functions, const API extends RestApi<Fs>>({
  module,
  api,
  endpoint,
  headers,
}: {
  module: module.Module
  api: API
  endpoint: string
  headers?: Record<string, string | string[] | undefined>
}): Sdk<Pick<Fs, keyof API['functions'] & keyof Fs>> {
  const functions = Object.fromEntries(
    Object.entries(module.functions).flatMap(([functionName, functionBody]) => {
      const specs = api.functions[functionName]
      const specification = Array.isArray(specs) ? specs[0] : specs
      if (!specification) {
        return []
      }
      const resolver = async ({ input, options }: { input: any; options?: { headers?: any; projection: any } }) => {
        const url = `${endpoint}/api${specification.path ?? `/${functionName}`}`
        const encodedInput = encoder.encode(functionBody.input, input as never)
        if (!encodedInput.isOk) {
          throw new Error(`Error while econding input ${JSON.stringify(encodedInput.error)}`)
        }
        const realUrl =
          specification.method === 'get' || specification.method === 'delete'
            ? `${url}?${encodeQueryObject(encodedInput.value, specification.inputName ?? 'input')}`
            : url
        const projectionHeader = projection != null ? { projection: JSON.stringify(projection) } : {}
        const response = await fetch(realUrl, {
          headers: { 'content-type': 'application/json', ...headers, ...options?.headers, ...projectionHeader },
          method: specification.method,
          body:
            specification.method !== 'get' && specification.method !== 'delete'
              ? JSON.stringify(encodedInput)
              : undefined,
        })
        const operationId = response.headers.get('operation-id')
        if (response.status === 200) {
          const json = await response.json()
          const partialOutputType = types.partialDeep(functionBody.output)
          const result = decoder.decode(partialOutputType, json)
          if (!result.isOk) {
            throw new Error(JSON.stringify(result.error))
          }
          const projectionRespected = projection.respectsProjection(
            functionBody.output,
            projection as never,
            result.value,
          )
          if (!projectionRespected.isOk) {
            throw new Error(JSON.stringify(projectionRespected.error))
          }
          return result.value as any
        }
        console.log(`Operation failed: ${operationId}`)
        throw new Error(await response.text())
      }
      return [[functionName, resolver]]
    }),
  )

  return {
    functions: functions as unknown as SdkFunctions<Fs>,
    withHeaders: (headers: Record<string, string | string[] | undefined>) => build({ api, endpoint, module, headers }),
  }
}
