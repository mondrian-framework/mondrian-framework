import { functions, logger, module } from '@mondrian-framework/module'
import { GraphQLErrorOptions } from 'graphql'

/**
 * The GraphQL API specification of a mondrian {@link module.ModuleInterface Module Interface}
 * This contains all information needed to generate graphql schema without the resolvers.
 * It does not contains the implementation. In order to instantiate this you should use {@link define}.
 */
export type ApiSpecification<Fs extends functions.FunctionsInterfaces> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | readonly FunctionSpecifications[]
  }
  options?: {
    introspection?: boolean
    path?: string
  }
  module: module.ModuleInterface<Fs>
}

/**
 * The same of {@link ApiSpecification} but this contains the {@link module.Module Module} so
 * this contains also the function implementations. With an instance of {@link Api} it is possible
 * to generate a fully featured graphql schema and serve the module as graphql endpoint.
 * In order to instantiate this you should use {@link build}.
 */
export type Api<Fs extends functions.Functions, ContextInput> = ApiSpecification<Fs> & {
  /**
   * Module to serve
   */
  module: module.Module<Fs, ContextInput>
}

/**
 * Builds a GraphQL API in order to expose the module.
 */
export function build<Fs extends functions.Functions, ContextInput>(api: Api<Fs, ContextInput>): Api<Fs, ContextInput> {
  //assertApiValidity(api) //TODO [Good first issue]: as rest.assertApiValidity
  return api
}

/**
 * Defines the GraphQL API with just the module interface.
 */
export function define<Fs extends functions.FunctionsInterfaces>(api: ApiSpecification<Fs>): ApiSpecification<Fs> {
  //assertApiValidity(api) //TODO [Good first issue]: as rest.assertApiValidity
  return api
}

export type FunctionSpecifications = {
  type: 'query' | 'mutation'
  name?: string
  inputName?: string
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
