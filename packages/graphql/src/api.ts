import { functions, logger, module } from '@mondrian-framework/module'
import { GraphQLErrorOptions } from 'graphql'

export type FunctionSpecifications = {
  type: 'query' | 'mutation'
  name?: string
  inputName?: string
  namespace?: string | null
}

export type ApiSpecification<Fs extends functions.FunctionsInterfaces> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | readonly FunctionSpecifications[]
  }
  options?: {
    introspection?: boolean
    pathPrefix?: string
  }
}

export type Api<Fs extends functions.Functions, ContextInput> = ApiSpecification<Fs> & {
  /**
   * Module to serve
   */
  module: module.Module<Fs, ContextInput>
}

export function build<Fs extends functions.Functions, ContextInput>(api: Api<Fs, ContextInput>): Api<Fs, ContextInput> {
  //assertApiValidity(api) //TODO [Good first issue]: as rest.assertApiValidity
  return api
}

export type ErrorHandler<F extends functions.Functions, ContextInput> = (
  args: {
    error: unknown
    log: logger.MondrianLogger
    functionName: keyof F
    context: unknown
    operationId: string
    functionArgs: {
      retrieve: unknown
      input: unknown
    }
  } & ContextInput,
) => Promise<{ message: string; options?: GraphQLErrorOptions } | void>
