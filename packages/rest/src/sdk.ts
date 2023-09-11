import { Api } from './api'
import { encodeQueryObject } from './utils'
import { projection, result, types } from '@mondrian-framework/model'
import { functions, module, sdk } from '@mondrian-framework/module'

export type Sdk<F extends functions.Functions> = {
  functions: SdkFunctions<F>
  withHeaders: (headers: Record<string, string | string[] | undefined>) => Sdk<F>
}

type SdkFunctions<F extends functions.Functions> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['error'], F[K]['output']>
}

type SdkFunction<InputType extends types.Type, ErrorType extends types.Type, OutputType extends types.Type> = <
  const P extends projection.FromType<OutputType>,
>(
  input: types.Infer<InputType>,
  options?: { projection?: P; headers?: Record<string, string | string[] | undefined> },
) => Promise<result.Result<sdk.Project<OutputType, P>, types.Infer<ErrorType>>>

//TODO: adapt to function error change
export function build<const Fs extends functions.Functions, const API extends Api<Fs>>({
  module,
  api,
  endpoint,
  headers,
}: {
  module: module.Module<Fs>
  api: API
  endpoint: string
  headers?: Record<string, string | string[] | undefined>
}): Sdk<Pick<Fs, keyof API['functions'] & keyof Fs>> {
  const functions = Object.fromEntries(
    Object.entries(module.functions).flatMap(([functionName, functionBody]) => {
      const specs = api.functions[functionName]
      const specification = Array.isArray(specs) ? specs[specs.length - 1] : specs
      if (!specification) {
        return []
      }
      const inputType = types.concretise(functionBody.input)
      const errorType = types.concretise(functionBody.error)
      const outputType = types.concretise(types.partialDeep(functionBody.output))
      const resolver = async (input: any, options?: { headers?: any; projection: any }) => {
        const url = `${endpoint}/${module.name}/api/v${specification.version?.max ?? specification.version?.min ?? 1}${
          specification.path ?? `/${functionName}`
        }`
        //TODO: build input with openapi specification (not always all in body)
        const encodedInput = inputType.encode(input as never)
        if (!encodedInput.isOk) {
          throw new Error(`Error while enconding input ${JSON.stringify(encodedInput.error)}`)
        }
        const realUrl =
          specification.method === 'get' || specification.method === 'delete'
            ? `${url}?${encodeQueryObject(encodedInput.value, specification.inputName ?? 'input')}`
            : url
        const projectionHeader = options?.projection != null ? { projection: JSON.stringify(options.projection) } : {}
        const response = await fetch(realUrl, {
          headers: { 'content-type': 'application/json', ...headers, ...options?.headers, ...projectionHeader },
          method: specification.method,
          body:
            specification.method !== 'get' && specification.method !== 'delete'
              ? JSON.stringify(encodedInput.value)
              : undefined,
        })
        const operationId = response.headers.get('operation-id')
        if (response.status === 200) {
          const json = await response.json()
          const res = outputType.decode(json, { typeCastingStrategy: 'tryCasting' })
          if (!res.isOk) {
            console.log(`Operation failed while decoding response: ${operationId}`)
            throw new Error(JSON.stringify(res.error))
          }
          const projectionRespected = projection.respectsProjection(
            functionBody.output,
            (options?.projection ?? true) as never,
            res.value as never,
          )
          if (!projectionRespected.isOk) {
            console.log(`Operation failed because output doen't respect projection: ${operationId}`)
            throw new Error(JSON.stringify(projectionRespected.error))
          }
          return result.ok(projectionRespected.value)
        } else if (errorType.kind === types.Kind.Union) {
          const json = await response.json()
          const error = errorType.decode(json, { typeCastingStrategy: 'tryCasting' })
          if (!error.isOk) {
            console.log(`Operation failed while decoding error: ${operationId}`)
            throw new Error(JSON.stringify(error.error))
          }
          return result.fail(error.value)
        }
        console.log(`Operation failed with unexpected error: ${operationId}`)
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
