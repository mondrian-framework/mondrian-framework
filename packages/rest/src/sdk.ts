import { ApiSpecification, FunctionSpecifications } from './api'
import { generateOpenapiInput } from './openapi'
import { retrieve, result, types } from '@mondrian-framework/model'
import { functions, module, sdk } from '@mondrian-framework/module'

export type Sdk<Fs extends functions.FunctionsInterfaces> = {
  functions: SdkFunctions<Fs>
  withHeaders: (headers: Record<string, string | string[] | undefined>) => Sdk<Fs>
}

type SdkFunctions<Fs extends functions.FunctionsInterfaces> = {
  [K in keyof Fs]: SdkFunction<Fs[K]['input'], Fs[K]['output'], Fs[K]['errors'], Fs[K]['retrieve']>
}

type SdkFunction<
  InputType extends types.Type,
  OutputType extends types.Type,
  E extends functions.ErrorType,
  C extends retrieve.Capabilities | undefined,
> = <const P extends retrieve.FromType<OutputType, C>>(
  input: types.Infer<InputType>,
  options?: { retrieve?: P; operationId?: string; headers?: Record<string, string | string[] | undefined> },
) => Promise<SdkFunctionResult<OutputType, E, C, P>>

type SdkFunctionResult<
  O extends types.Type,
  E extends functions.ErrorType,
  C extends retrieve.Capabilities | undefined,
  P extends retrieve.FromType<O, C>,
> = [E] extends [types.Types]
  ? result.Result<sdk.Project<O, P>, { [K in keyof E]: types.Infer<E[K]> }>
  : sdk.Project<O, P>

function getRequestBuilder(args: { specification: FunctionSpecifications; functionBody: functions.FunctionInterface }) {
  return generateOpenapiInput({ ...args, typeMap: {}, typeRef: new Map() }).request
}

export function build<const Fs extends functions.FunctionsInterfaces, const API extends ApiSpecification<Fs>>({
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
      const outputType = types.concretise(types.partialDeep(functionBody.output))
      const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
      const requestBuilder = getRequestBuilder({ specification, functionBody })
      const resolver = async (input: never, options?: { headers?: any; retrieve: any }) => {
        const url = `${endpoint}/${module.name}/api/v${specification.version?.max ?? specification.version?.min ?? 1}${
          specification.path ?? `/${functionName}`
        }`
        const request = requestBuilder(input)
        const urlWithParam = Object.entries(request.params ?? {}).reduce((p, [key, param]) => {
          return p.replaceAll(`{${key}}`, param)
        }, url)
        const finalUrl = request.query ? `${urlWithParam}?${request.query}` : urlWithParam
        const retrieveHeader = retrieveType.isOk
          ? options?.retrieve != null
            ? {
                retrieve: JSON.stringify(
                  types.concretise(retrieveType.value).encodeWithoutValidation(options.retrieve as never),
                ),
              }
            : {}
          : {}
        // file deepcode ignore Ssrf: this request is built with already validated input
        const response = await fetch(finalUrl, {
          headers: { 'content-type': 'application/json', ...headers, ...options?.headers, ...retrieveHeader },
          method: specification.method,
          body: request.body !== undefined ? JSON.stringify(request.body) : null,
        })
        const operationId = response.headers.get('operation-id')
        if (response.status === 200) {
          const json = await response.json()
          const res = outputType.decode(json, { typeCastingStrategy: 'tryCasting' })
          if (!res.isOk) {
            throw new Error(JSON.stringify(res.error))
          }
          if (functionBody.errors) {
            return result.ok(res.value)
          } else {
            return res.value
          }
        } else if (functionBody.errors) {
          const json = await response.json()
          const [error] = Object.entries(functionBody.errors).flatMap(([k, v]) =>
            typeof json === 'object' && json && k in json ? [[k, v, json[k]] as const] : [],
          )
          if (!error) {
            throw new Error(`Unexpected error: ${JSON.stringify(json)}`)
          }
          const [errorName, errorType, errorValue] = error
          const decodedError = types.concretise(errorType).decode(errorValue, { typeCastingStrategy: 'tryCasting' })
          if (!decodedError.isOk) {
            throw new Error(JSON.stringify(decodedError.error))
          }
          return result.fail({ [errorName]: decodedError.value })
        } else {
          throw new Error(await response.text())
        }
      }
      return [[functionName, resolver]]
    }),
  )

  return {
    functions: functions as unknown as SdkFunctions<Fs>,
    withHeaders: (headers: Record<string, string | string[] | undefined>) => build({ api, endpoint, module, headers }),
  }
}
