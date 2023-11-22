import { ApiSpecification, FunctionSpecifications } from './api'
import { clearInternalData, emptyInternalData, generateOpenapiInput } from './openapi'
import { retrieve, result, model } from '@mondrian-framework/model'
import { functions, module, sdk } from '@mondrian-framework/module'

export type Sdk<Fs extends functions.FunctionsInterfaces> = {
  functions: SdkFunctions<Fs>
  withHeaders: (headers: Record<string, string | string[] | undefined>) => Sdk<Fs>
}

type SdkFunctions<Fs extends functions.FunctionsInterfaces> = {
  [K in keyof Fs]: SdkFunction<Fs[K]['input'], Fs[K]['output'], Fs[K]['errors'], Fs[K]['retrieve']>
}

type SdkFunction<
  InputType extends model.Type,
  OutputType extends model.Type,
  E extends functions.ErrorType,
  C extends retrieve.Capabilities | undefined,
> = <const P extends retrieve.FromType<OutputType, C>>(
  input: model.Infer<InputType>,
  options?: { retrieve?: P; operationId?: string; headers?: Record<string, string | string[] | undefined> },
) => Promise<SdkFunctionResult<OutputType, E, C, P>>

type SdkFunctionResult<
  O extends model.Type,
  E extends functions.ErrorType,
  C extends retrieve.Capabilities | undefined,
  P extends retrieve.FromType<O, C>,
> = [Exclude<E, undefined>] extends [never]
  ? sdk.Project<O, P>
  : result.Result<sdk.Project<O, P>, { [K in keyof Exclude<E, undefined>]: model.Infer<Exclude<E, undefined>[K]> }>

function getRequestBuilder(args: { specification: FunctionSpecifications; functionBody: functions.FunctionInterface }) {
  const internalData = emptyInternalData()
  const result = generateOpenapiInput({ ...args, internalData }).request
  clearInternalData(internalData)
  return result
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
        return [
          [
            functionName,
            () => {
              throw new Error(`${functionName} is not exposed through rest api.`)
            },
          ],
        ]
      }
      const outputType = model.concretise(model.partialDeep(functionBody.output))
      const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
      const requestBuilder = getRequestBuilder({ specification, functionBody })
      const resolver = async (input: never, options?: { headers?: any; retrieve: any }) => {
        const url = `${endpoint}${api.options?.pathPrefix ?? '/api'}/v${
          specification.version?.max ?? specification.version?.min ?? 1
        }${specification.path ?? `/${functionName}`}`
        const request = requestBuilder(input)
        const urlWithParam = Object.entries(request.params ?? {}).reduce((p, [key, param]) => {
          return p.replaceAll(`{${key}}`, param)
        }, url)
        const finalUrl = request.query ? `${urlWithParam}?${request.query}` : urlWithParam
        const retrieveHeader = retrieveType.isOk
          ? options?.retrieve != null
            ? {
                retrieve: JSON.stringify(
                  model.concretise(retrieveType.value).encodeWithoutValidation(options.retrieve as never),
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
        const operationId = response.headers.get('operationId')
        const json = await readJSON(response) //TODO: better error message
        if (!json.isOk) {
          throw new Error(json.error)
        } else if (response.status >= 200 && response.status < 299) {
          const res = outputType.decode(json.value, { typeCastingStrategy: 'tryCasting' })
          if (!res.isOk) {
            throw new Error(JSON.stringify(res.error))
          }
          if (functionBody.errors) {
            return result.ok(res.value)
          } else {
            return res.value
          }
        } else if (functionBody.errors) {
          const jsonValue = json.value
          const [error] = Object.entries(functionBody.errors).flatMap(([k, v]) =>
            typeof jsonValue === 'object' && jsonValue && k in jsonValue ? [[k, v, jsonValue[k]] as const] : [],
          )
          if (!error) {
            throw new Error(`Unexpected error: ${JSON.stringify(jsonValue)}`)
          }
          const [errorName, errorType, errorValue] = error
          const decodedError = model.concretise(errorType).decode(errorValue, { typeCastingStrategy: 'tryCasting' })
          if (!decodedError.isOk) {
            throw new Error(JSON.stringify(decodedError.error))
          }
          return result.fail({ [errorName]: decodedError.value })
        } else {
          throw new Error(JSON.stringify(json.value)) //TODO: better error message
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

async function readJSON(response: Response): Promise<result.Result<any, string>> {
  const text = await response.text()
  try {
    return result.ok(JSON.parse(text))
  } catch {
    return result.fail(text)
  }
}
