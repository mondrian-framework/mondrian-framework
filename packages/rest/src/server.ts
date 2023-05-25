import { Types } from '@mondrian/model'
import { Functions, Logger, Module } from '@mondrian/module'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { fastifyStatic } from '@fastify/static'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import path from 'path'
import fs from 'fs'
import { attachRestMethods, openapiSpecification } from './openapi'
import { JSONType, isArray } from '@mondrian/utils'

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

export function serve<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>, CI>({
  module,
  api,
  server,
  context,
}: {
  module: Module<T, F, CI>
  api: ModuleRestApi<F>
  server: FastifyInstance
  context: (args: { request: FastifyRequest }) => Promise<CI>
}): void {
  const pathPrefix = api.options?.pathPrefix ?? `/${module.name.toLocaleLowerCase()}/api`
  const globalMaxVersion = Object.values(api.functions)
    .flatMap((v) => (v ? (isArray(v) ? v : [v]) : []))
    .map((v) => Math.max(v.version?.max ?? 0, v.version?.min ?? 0))
    .reduce((p, c) => Math.max(p, c), api.version ?? 1)
  if (api.options?.introspection) {
    server.register(fastifyStatic, {
      root: getAbsoluteFSPath(),
      prefix: `${pathPrefix}/doc`,
    })
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${pathPrefix}/doc/v${globalMaxVersion}/schema.json`)
    server.get(`${pathPrefix}/doc/swagger-initializer.js`, (req, res) => res.send(indexContent))
    server.get(`${pathPrefix}/doc`, (req, res) => {
      res.redirect(`${pathPrefix}/doc/index.html`)
    })
    server.get(`${pathPrefix}/doc/:v/schema.json`, (req, reply) => {
      const v = (req.params as Record<string, string>).v
      const version = Number(v.replace('v', ''))
      if (Number.isNaN(version) || version < 1 || version > globalMaxVersion) {
        reply.status(404)
        return { error: 'Invalid version', minVersion: `v1`, maxVersion: `v${globalMaxVersion}` }
      }
      return openapiSpecification({ module, api, pathPrefix, version })
    })
  }
  attachRestMethods({ module, api, server, context, pathPrefix, globalMaxVersion })
}
