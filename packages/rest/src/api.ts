import { assertApiValidity } from './utils'
import { retrieve, model } from '@mondrian-framework/model'
import { functions, logger, module } from '@mondrian-framework/module'
import { OpenAPIV3_1 } from 'openapi-types'

export type ApiSpecification<Fs extends functions.FunctionsInterfaces> = {
  /**
   * The current api version. Must be an integer greater than or quelas to 1.
   */
  version: number
  /**
   * Functions specification map.
   */
  functions: {
    [K in keyof Fs]?: FunctionSpecifications<Fs[K]> | FunctionSpecifications<Fs[K]>[]
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
   * Available openapi securities. The key is used as reference in the function specification.
   */
  securities?: Record<string, OpenAPIV3_1.SecuritySchemeObject>
}

export type Api<Fs extends functions.Functions, ContextInput> = ApiSpecification<Fs> & {
  /**
   * Module to serve
   */
  module: module.Module<Fs, ContextInput>
}

export function build<Fs extends functions.Functions, ContextInput>(api: Api<Fs, ContextInput>): Api<Fs, ContextInput> {
  assertApiValidity(api)
  return api
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
    request?: (input: model.Infer<F['input']>) => {
      body?: unknown
      params?: Record<string, string>
      query?: string
    }
  }
  errorCodes?: { [K in keyof F['errors']]?: number }
  namespace?: string | null
  security?: OpenAPIV3_1.SecurityRequirementObject[]
}

type NullableOperationObject = {
  [K in keyof OpenAPIV3_1.OperationObject]: OpenAPIV3_1.OperationObject[K] | null
}
