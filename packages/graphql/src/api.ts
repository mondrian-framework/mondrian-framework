import { functions, logger } from '@mondrian-framework/module'
import { GraphQLErrorOptions } from 'graphql'

type FunctionSpecifications = {
  type: 'query' | 'mutation'
  name?: string
  inputName?: string
  namespace?: string | null
}

export type Api<Fs> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | readonly FunctionSpecifications[]
  }
  options?: {
    introspection?: boolean
    pathPrefix?: string
  }
}

export type ErrorHandler<F extends functions.Functions, ContextInput> = (
  args: {
    error: unknown
    log: logger.MondrianLogger
    functionName: keyof F
    context: unknown
    operationId: string
    functionArgs: {
      projection: unknown
      input: unknown
    }
  } & ContextInput,
) => Promise<{ message: string; options?: GraphQLErrorOptions } | void>
