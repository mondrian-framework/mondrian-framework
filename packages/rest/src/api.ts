import { retrieve, types } from '@mondrian-framework/model'
import { functions, logger } from '@mondrian-framework/module'
import { OpenAPIV3_1 } from 'openapi-types'

export type Api<F extends functions.FunctionsInterfaces> = {
  functions: {
    [K in keyof F]?: FunctionSpecifications<F[K]> | FunctionSpecifications<F[K]>[]
  }
  options?: {
    /**
     * Default path is /openapi
     */
    introspection?: true | { path: string }
    /**
     * Default is /api
     */
    pathPrefix?: string
  }
  /**
   * The current api version. Must be an integer greater than or quelas to 1.
   */
  version: number
}

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type Request = {
  body: unknown
  params: Record<string, string | undefined>
  query: Record<string, string | undefined>
  headers: Record<string, string | string[] | undefined>
  method: Method
  route: string
}

export type Response = { status: number; body: unknown; headers?: Record<string, string> }

export type ErrorHandler<Fs extends functions.Functions, RestContext> = (
  args: {
    error: unknown
    logger: logger.MondrianLogger
    functionName: keyof Fs
    context: unknown
    operationId: string
    functionArgs: {
      retrieve?: retrieve.GenericRetrieve
      input?: unknown
    }
  } & RestContext,
) => Promise<Response | void>

export type FunctionSpecifications<F extends functions.FunctionInterface = functions.FunctionInterface> = {
  method: Method
  path?: string
  inputName?: string
  version?: { min?: number; max?: number }
  openapi?: {
    specification: NullableOperationObject
    input: (request: Request) => unknown
    request?: (input: types.Infer<F['input']>) => {
      body?: unknown
      params?: Record<string, string>
      query?: string
    }
  }
  errorCodes?: { [K in keyof F['errors']]?: number }
  namespace?: string | null
}

type NullableOperationObject = {
  [K in keyof OpenAPIV3_1.OperationObject]: OpenAPIV3_1.OperationObject[K] | null
}
