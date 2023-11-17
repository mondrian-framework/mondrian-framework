import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'

export type ApiSpecification<Fs extends functions.Functions> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications<Fs[K]['input']>
  }
}

export type Api<Fs extends functions.Functions, CI> = ApiSpecification<Fs> & {
  module: module.Module<Fs, CI>
}

export type FunctionSpecifications<InputType extends model.Type> = {
  cron: string
  runAtStart?: boolean
  timezone?: string
  input: () => Promise<model.Infer<InputType>>
}

/**
 * TODO: doc
 */
export function build<const Fs extends functions.Functions, CI>(api: Api<Fs, CI>): Api<Fs, CI> {
  //TODO [Good first issue]: check validity of api as rest.build
  return api
}
