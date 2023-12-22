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
> = <const P extends retrieve.FromType<OutputType, Exclude<C, undefined>>>(
  input: model.IsNever<InputType> extends true ? null : model.Infer<InputType>,
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
    const responseType = Response(functionBody)

    return async (input: never, options?: { retrieve?: never; metadata?: Record<string, string> }) => {
      const inputJson = model.isNever(functionBody.input)
        ? undefined
        : model.concretise(functionBody.input).encodeWithoutValidation(input)
      const retrieveJson =
        retrieveType.isOk && options?.retrieve
          ? model.concretise(retrieveType.value).encodeWithoutValidation(options.retrieve)
          : undefined

      const payload = {
        functionName,
        input: inputJson,
        retrieve: retrieveJson,
        metadata: options?.metadata ?? metadata,
      }

      let jsonResult
      if (typeof endpoint === 'string') {
        const fetchResult = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        jsonResult = await fetchResult.json()
      } else {
        const response = await endpoint({
          body: JSON.parse(JSON.stringify(payload)),
          method: 'post',
          route: '/',
          headers: {},
          params: {},
          query: {},
        })
        jsonResult = response.body
        if (response.status > 299 || response.status < 200) {
          throw new Error('0')
        }
      }
      const decoded = responseType.decode(jsonResult, {
        errorReportingStrategy: 'stopAtFirstError',
        fieldStrictness: 'expectExactFields',
        typeCastingStrategy: 'expectExactTypes',
      })
      if (decoded.isFailure) {
        throw new Error('1')
      }
      if (!decoded.value.success) {
        throw new Error(decoded.value.reason, { cause: decoded.value.additionalInfo })
      }
      if (functionBody.errors) {
        if (decoded.value.result.isOk) {
          return result.ok(decoded.value.result.value)
        } else {
          return result.ok(decoded.value.result.errors)
        }
      } else {
        if (decoded.value.result.isOk) {
          return decoded.value.result.value
        } else {
          throw new Error('3')
        }
      }
    }
  })

  return {
    functions: funcs as unknown as Sdk<Fs>['functions'],
    withMetadata: (metadata) => build({ endpoint, module, metadata }),
  }
}
