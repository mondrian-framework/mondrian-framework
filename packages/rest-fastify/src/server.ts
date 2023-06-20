import { attachRestMethods } from './methods'
import { ServerContext } from './utils'
import { fastifyStatic } from '@fastify/static'
import { Functions, Module } from '@mondrian-framework/module'
import { ErrorHandler, RestApi, generateOpenapiDocument, getMaxVersion } from '@mondrian-framework/rest'
import { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export function serve<const F extends Functions, CI>({
  module,
  api,
  server,
  context,
  error,
}: {
  module: Module<F, CI>
  api: RestApi<F>
  server: FastifyInstance
  context: (serverContext: ServerContext) => Promise<CI>
  error?: ErrorHandler<F, ServerContext>
}): void {
  const pathPrefix = `/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`
  const globalMaxVersion = getMaxVersion(api)
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
  attachRestMethods({ module, api, server, context, pathPrefix, error })
}
