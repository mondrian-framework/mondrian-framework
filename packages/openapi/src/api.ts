import { Functions, Logger } from '@mondrian-framework/module'
import { JSONType } from '@mondrian-framework/utils'
import { FastifyReply, FastifyRequest } from 'fastify'

export type RestFunctionSpecs = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path?: string
  version?: { min?: number; max?: number }
}

export type ModuleRestApi<F extends Functions> = {
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
  errorHandler?: (args: {
    request: FastifyRequest
    reply: FastifyReply
    error: unknown
    log: Logger
    functionName: keyof F
    context: unknown
    operationId: string
    functionArgs: {
      projection: unknown
      input: unknown
    }
  }) => Promise<JSONType | void>
}
