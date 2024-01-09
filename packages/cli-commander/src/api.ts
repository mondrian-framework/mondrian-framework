import { result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'

type InputBindingStyle = 'single-json' | 'argument-spreaded'
/**
 * The commander API specification of a mondrian {@link module.ModuleInterface Module Interface}
 * It does not contains the implementation. In order to instantiate this you should use {@link define}.
 */
export type ApiSpecification<Fs extends functions.FunctionsInterfaces> = {
  version?: string
  inputBindingStyle?: 'single-json' | 'argument-spreaded'
  functions: {
    [K in keyof Fs]?: boolean | { command?: string; inputBindingStyle?: InputBindingStyle }
  }
  module: module.ModuleInterface<Fs>
}

/**
 * The same of {@link ApiSpecification} but this contains the {@link module.Module Module} so
 * this contains also the function implementations. With an instance of {@link Api} it is possible
 * execute functions with a cli call.
 * In order to instantiate this you should use {@link build}.
 */
export type Api<Fs extends functions.Functions, E extends functions.ErrorType, CI> = ApiSpecification<Fs> & {
  module: module.Module<Fs, E, CI>
  output?: (result: result.Result<unknown, unknown>, args: { functionName: string }) => Promise<void>
}

/**
 * Builds a commander API in order to schedule function execution.
 */
export function build<Fs extends functions.Functions, E extends functions.ErrorType, CI>(
  api: Api<Fs, E, CI>,
): Api<Fs, E, CI> {
  //TODO [Good first issue]: check validity of api as rest.build
  return api
}

/**
 * Defines the commander API with just the module interface.
 */
export function define<const Fs extends functions.FunctionsInterfaces>(
  api: ApiSpecification<Fs>,
): ApiSpecification<Fs> {
  //TODO [Good first issue]: check validity of api as rest.define
  return api
}
