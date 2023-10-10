import { Api, FunctionSpecifications, Request } from './api'
import { generateOpenapiInput } from './openapi'
import { projection, result, types } from '@mondrian-framework/model'
import { functions, module, sdk } from '@mondrian-framework/module'

export type Sdk<Fs extends functions.FunctionsInterfaces> = {
  functions: SdkFunctions<Fs>
  withHeaders: (headers: Record<string, string | string[] | undefined>) => Sdk<Fs>
}

type SdkFunctions<Fs extends functions.FunctionsInterfaces> = {
  [K in keyof Fs]: SdkFunction<Fs[K]['input'], Fs[K]['error'], Fs[K]['output']>
}

type SdkFunction<InputType extends types.Type, ErrorType extends functions.ErrorType, OutputType extends types.Type> = <
  const P extends projection.FromType<OutputType>,
>(
  input: types.Infer<InputType>,
  options?: { projection?: P; headers?: Record<string, string | string[] | undefined> },
) => Promise<SdkFunctionResult<ErrorType, OutputType, P>>

type SdkFunctionResult<
  ErrorType extends functions.ErrorType,
  OutputType extends types.Type,
  P extends projection.FromType<OutputType>,
> = [ErrorType] extends [undefined]
  ? sdk.Project<OutputType, P>
  : [ErrorType] extends [types.UnionType<any>]
  ? result.Result<sdk.Project<OutputType, P>, types.Infer<ErrorType>>
  : never

function getRequestBuilder(args: { specification: FunctionSpecifications; functionBody: functions.FunctionInterface }) {
  return generateOpenapiInput({ ...args, typeMap: {}, typeRef: new Map() }).request
}

//TODO: adapt to function error change
export function build<const Fs extends functions.FunctionsInterfaces, const API extends Api<Fs>>({
  module,
  api,
  endpoint,
  headers,
}: {
  module: module.ModuleInterface<Fs>
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
      const errorType = functionBody.error ? types.concretise(functionBody.error) : undefined
      const outputType = types.concretise(types.partialDeep(functionBody.output))
      const requestBuilder = getRequestBuilder({ specification, functionBody })
      const resolver = async (input: never, options?: { headers?: any; projection: any }) => {
        const url = `${endpoint}/${module.name}/api/v${specification.version?.max ?? specification.version?.min ?? 1}${
          specification.path ?? `/${functionName}`
        }`
        const request = requestBuilder(input)
        const urlWithParam = Object.entries(request.params ?? {}).reduce((p, [key, param]) => {
          return p.replaceAll(`{${key}}`, param)
        }, url)
        const finalUrl = request.query ? `${urlWithParam}?${request.query}` : urlWithParam
        const projectionHeader = options?.projection != null ? { projection: JSON.stringify(options.projection) } : {}
        // file deepcode ignore Ssrf: this request is built with already validated input
        const response = await fetch(finalUrl, {
          headers: { 'content-type': 'application/json', ...headers, ...options?.headers, ...projectionHeader },
          method: specification.method,
          body: request.body !== undefined ? JSON.stringify(request.body) : null,
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
        } else if (errorType) {
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
