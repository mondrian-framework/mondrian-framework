import { Functions, Logger } from '@mondrian-framework/module'

export type ErrorHandler<F extends Functions, RestContext> = (
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
  } & RestContext,
) => Promise<{ status: number; body: unknown; headers?: Record<string, string> } | void>

export type RestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type RestFunctionSpecs = {
  method: RestMethod
  path?: string
  version?: { min?: number; max?: number }
}

export type RestApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: RestFunctionSpecs | readonly RestFunctionSpecs[]
  }
  options?: {
    introspection?: boolean
    /**
     * Default is /api
     */
    pathPrefix?: string
  }
  version?: number
}
