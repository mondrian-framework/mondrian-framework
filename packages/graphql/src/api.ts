import { functions, logger, module } from '@mondrian-framework/module'
import { GraphQLErrorOptions } from 'graphql'

export type FunctionSpecifications = {
  type: 'query' | 'mutation'
  name?: string
  inputName?: string
}

export type ApiSpecification<Fs extends functions.FunctionsInterfaces> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | readonly FunctionSpecifications[]
  }
  options?: {
    introspection?: boolean
    pathPrefix?: string
  }
  module: module.ModuleInterface<Fs>
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

export function define<Fs extends functions.FunctionsInterfaces>(api: ApiSpecification<Fs>): ApiSpecification<Fs> {
  //assertApiValidity(api) //TODO [Good first issue]: as rest.assertApiValidity
  return api
}

export type ErrorHandler<F extends functions.Functions, ServerContext> = (
  args: {
    error: unknown
    logger: logger.MondrianLogger
    functionName: keyof F
    context: unknown
    operationId: string
    functionArgs: {
      retrieve: unknown
      input: unknown
    }
  } & ServerContext,
) => Promise<{ message: string; options?: GraphQLErrorOptions } | void>
