import { ApiSpecification, FunctionSpecifications } from './api'
import { clearInternalData, emptyInternalData, generateOpenapiInput } from './openapi'
import { result, model } from '@mondrian-framework/model'
import { functions, module, sdk, utils, retrieve } from '@mondrian-framework/module'


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
> = <const P extends retrieve.FromType<OutputType, Exclude<C, undefined>>>(
  input: model.Infer<InputType>,
  options?: { retrieve?: P; headers?: Record<string, string | string[] | undefined> },
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
  metadata,
}: {
  endpoint: string
  metadata?: Record<string, string>
}): Sdk<Fs> {
  const proxy = new Proxy({} as SdkFunctions<Fs>, {
    get(_obj, name) {
      return name.toString() + '1'
    },
  })
  return {
    functions: proxy,
    withHeaders: (headers: Record<string, string | string[] | undefined>) => build({ api, endpoint, headers }),
  }
}
