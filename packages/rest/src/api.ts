import { Functions, Logger } from '@mondrian-framework/module'
import { OpenAPIV3_1 } from 'openapi-types'

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
export type RestRequest = {
  body: unknown
  params: Record<string, string | undefined>
  query: Record<string, string | undefined>
  headers: Record<string, string | string[] | undefined>
  method: RestMethod
}

export type RestFunctionSpecs = {
  method: RestMethod
  path?: string
  inputName?: string
  version?: { min?: number; max?: number }
  openapi?: {
    specification: NullableOperationObject
    input: (request: RestRequest) => unknown
  }
  namespace?: string | null
}

type NullableOperationObject = {
  [K in keyof OpenAPIV3_1.OperationObject]: OpenAPIV3_1.OperationObject[K] | null
}

export type RestApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: RestFunctionSpecs | RestFunctionSpecs[]
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
