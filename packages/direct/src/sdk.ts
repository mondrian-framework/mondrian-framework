import { Response } from './handler'
import { result, model } from '@mondrian-framework/model'
import { functions, module, sdk, retrieve } from '@mondrian-framework/module'
import { http, mapObject } from '@mondrian-framework/utils'

export type Sdk<Fs extends functions.FunctionsInterfaces> = {
  functions: SdkFunctions<Fs>
  withMetadata: (metadata: Record<string, string>) => Sdk<Fs>
}

type SdkFunctions<Fs extends functions.FunctionsInterfaces> = {
  [K in keyof Fs]: SdkFunction<Fs[K]['input'], Fs[K]['output'], Fs[K]['errors'], Fs[K]['retrieve']>
}

type SdkFunction<
  InputType extends model.Type,
  OutputType extends model.Type,
  E extends functions.ErrorType,
  C extends retrieve.Capabilities | undefined,
> = model.IsNever<InputType> extends true
  ? <const P extends retrieve.FromType<OutputType, Exclude<C, undefined>>>(
      input?: undefined,
      options?: [P] extends [never]
        ? { metadata?: Record<string, string> }
        : { retrieve?: P; metadata?: Record<string, string> },
    ) => Promise<SdkFunctionResult<OutputType, E, C, P>>
  : <const P extends retrieve.FromType<OutputType, Exclude<C, undefined>>>(
      input: model.Infer<InputType>,
      options?: [P] extends [never]
        ? { metadata?: Record<string, string> }
        : { retrieve?: P; metadata?: Record<string, string> },
    ) => Promise<SdkFunctionResult<OutputType, E, C, P>>

type SdkFunctionResult<
  O extends model.Type,
  E extends functions.ErrorType,
  C extends retrieve.Capabilities | undefined,
  P extends retrieve.FromType<O, C>,
> = [Exclude<E, undefined>] extends [never]
  ? sdk.Project<O, P>
  : result.Result<sdk.Project<O, P>, { [K in keyof Exclude<E, undefined>]: model.Infer<Exclude<E, undefined>[K]> }>

export function build<const Fs extends functions.FunctionsInterfaces>({
  endpoint,
  module,
  metadata,
}: {
  endpoint: string | http.Handler
  module: module.ModuleInterface<Fs>
  metadata?: Record<string, string>
}): Sdk<Fs> {
  const funcs = mapObject(module.functions, (functionName, functionBody) => {
    const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)

    return async (input: never, options?: { retrieve?: never; metadata?: Record<string, string> }) => {
      const responseType = Response(functionBody, options?.retrieve)

      const inputJson = model.isNever(functionBody.input)
        ? undefined
        : model.concretise(functionBody.input).encodeWithoutValidation(input)
      const retrieveJson = retrieveType.isOk
        ? model.concretise(retrieveType.value).encodeWithoutValidation(options?.retrieve ?? {})
        : undefined

      const payload = {
        functionName,
        input: inputJson,
        retrieve: retrieveJson,
        metadata: options?.metadata ?? metadata,
      }

      let jsonBody: () => Promise<unknown>
      let stringBody: () => Promise<string>
      let status: number
      if (typeof endpoint === 'string') {
        const fetchResult = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        status = fetchResult.status
        jsonBody = () => fetchResult.json()
        stringBody = () => fetchResult.text()
      } else {
        const request: http.Request = {
          body: JSON.parse(JSON.stringify(payload)),
          method: 'post',
          route: '/',
          headers: {},
          params: {},
          query: {},
        }
        const response = await endpoint({
          request,
          serverContext: { request },
        })
        status = response.status
        jsonBody = () => Promise.resolve(response.body)
        stringBody = () =>
          Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body))
      }
      if (status > 299 || status < 200) {
        const errorString = await stringBody().catch(() => '')
        throw new Error(`Unexpected status code: ${status}. ${errorString}`)
      }
      const json = await jsonBody()
      const decoded = responseType.decode(json, {
        errorReportingStrategy: 'stopAtFirstError',
        fieldStrictness: 'expectExactFields',
        typeCastingStrategy: 'expectExactTypes',
      })
      if (decoded.isFailure) {
        throw new Error('Error while decoding response', { cause: decoded.error })
      }
      if (!decoded.value.success) {
        if (decoded.value.reason === 'Function throws error') {
          throw new Error(decoded.value.additionalInfo as string)
        } else {
          throw new Error(decoded.value.reason, { cause: decoded.value.additionalInfo })
        }
      }
      if (functionBody.errors) {
        if (decoded.value.result.isOk) {
          return result.ok(decoded.value.result.value)
        } else {
          return result.fail(decoded.value.result.errors)
        }
      } else {
        if (decoded.value.result.isOk) {
          return decoded.value.result.value
        } else {
          throw new Error('Failure should not be present because the function does not declare errors', {
            cause: decoded.value.result.errors,
          })
        }
      }
    }
  })

  return {
    functions: funcs as unknown as Sdk<Fs>['functions'],
    withMetadata: (metadata) => build({ endpoint, module, metadata }),
  }
}
