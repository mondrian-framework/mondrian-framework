import { functions, logger } from '@mondrian-framework/module'
import { OpenAPIV3_1 } from 'openapi-types'

export type Api<F extends functions.Functions> = {
  functions: {
    [K in keyof F]?: FunctionSpecifications | FunctionSpecifications[]
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

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type Request = {
  body: unknown
  params: Record<string, string | undefined>
  query: Record<string, string | undefined>
  headers: Record<string, string | string[] | undefined>
  method: Method
}

export type ErrorHandler<Fs extends functions.Functions, RestContext> = (
  args: {
    error: unknown
    log: logger.Logger
    functionName: keyof Fs
    context: unknown
    operationId: string
    functionArgs: {
      projection: unknown
      input: unknown
    }
  } & RestContext,
) => Promise<{ status: number; body: unknown; headers?: Record<string, string> } | void>

export type FunctionSpecifications = {
  method: Method
  path?: string
  inputName?: string
  version?: { min?: number; max?: number }
  openapi?: {
    specification: NullableOperationObject
    input: (request: Request) => unknown
  }
  namespace?: string | null
}

type NullableOperationObject = {
  [K in keyof OpenAPIV3_1.OperationObject]: OpenAPIV3_1.OperationObject[K] | null
}
