import { attachRestMethods } from './methods'
import { fastifyStatic } from '@fastify/static'
import { Types } from '@mondrian-framework/model'
import { Functions, Module } from '@mondrian-framework/module'
import { ModuleRestApi, generateOpenapiDocument } from '@mondrian-framework/openapi'
import { isArray } from '@mondrian-framework/utils'
import { FastifyInstance, FastifyRequest } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

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
  const pathPrefix = `/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`
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
      return generateOpenapiDocument({ module, api, version })
    })
  }
  attachRestMethods({ module, api, server, context, pathPrefix, globalMaxVersion })
}
