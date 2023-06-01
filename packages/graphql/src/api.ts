import { Functions, Logger } from '@mondrian-framework/module'
import { GraphQLError, GraphQLErrorOptions } from 'graphql'

export type GraphqlFunctionSpecs = { type: 'query' | 'mutation'; name?: string; inputName?: string }

export type GraphqlApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: GraphqlFunctionSpecs | readonly GraphqlFunctionSpecs[]
  }
  options?: {
    introspection?: boolean
    pathPrefix?: string
  }
}

export type ErrorHandler<F extends Functions, ContextInput> = (
  args: {
    error: unknown
    log: Logger
    functionName: keyof F
    context: unknown
    operationId: string
    functionArgs: {
      projection: unknown
      input: unknown
    }
  } & ContextInput,
) => Promise<{ message: string; options?: GraphQLErrorOptions } | void>
