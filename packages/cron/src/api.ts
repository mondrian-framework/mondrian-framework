import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'

/**
 * The Cron API specification of a mondrian {@link module.ModuleInterface Module Interface}
 * It does not contains the implementation. In order to instantiate this you should use {@link define}.
 */
export type ApiSpecification<Fs extends functions.FunctionInterfaces> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications<Fs[K]['input']>
  }
  module: module.ModuleInterface<Fs>
}

/**
 * The same of {@link ApiSpecification} but this contains the {@link module.Module Module} so
 * this contains also the function implementations. With an instance of {@link Api} it is possible
 * schedule functions execution with a cron string.
 * In order to instantiate this you should use {@link build}.
 */
export type Api<Fs extends functions.FunctionImplementations> = ApiSpecification<Fs> & {
  module: module.Module<Fs>
}

export type FunctionSpecifications<InputType extends model.Type> = {
  cron: string
  runAtStart?: boolean
  timezone?: string
} & InputGenerator<InputType>

//prettier-ignore
type InputGenerator<InputType extends model.Type> 
  = model.IsLiteral<InputType, undefined> extends true ? {}
  : model.IsOptional<InputType> extends true ? { input?: () => Promise<model.Infer<InputType>> }
  : { input: () => Promise<model.Infer<InputType>> }

/**
 * Builds a cron API in order to schedule function execution.
 */
export function build<Fs extends functions.FunctionImplementations>(api: Api<Fs>): Api<Fs> {
  //TODO [Good first issue]: check validity of api as rest.build
  return api
}

/**
 * Defines the cron API with just the module interface.
 */
export function define<const Fs extends functions.FunctionInterfaces>(api: ApiSpecification<Fs>): ApiSpecification<Fs> {
  //TODO [Good first issue]: check validity of api as rest.define
  return api
}
