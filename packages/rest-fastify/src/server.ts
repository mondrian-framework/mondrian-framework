import { attachRestMethods } from './methods'
import { fastifyStatic } from '@fastify/static'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { FastifyReply, FastifyRequest } from 'fastify'
import { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export type Context = { fastify: { request: FastifyRequest; reply: FastifyReply } }

export function serve<const F extends functions.Functions, CI>({
  module,
  api,
  fastifyInstance,
  context,
  error,
}: {
  module: module.Module<F, CI>
  api: rest.Api<F>
  fastifyInstance: FastifyInstance
  context: (serverContext: Context) => Promise<CI>
  error?: rest.ErrorHandler<F, Context>
}): void {
  utils.assertApiValidity(api)
  const pathPrefix = `/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`
  if (api.options?.introspection) {
    fastifyInstance.register(fastifyStatic, {
      root: getAbsoluteFSPath(),
      prefix: `${pathPrefix}/doc`,
    })
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${pathPrefix}/doc/v${api.version}/schema.json`)
    fastifyInstance.get(`${pathPrefix}/doc/swagger-initializer.js`, (req, res) => res.send(indexContent))
    fastifyInstance.get(`${pathPrefix}/doc`, (req, res) => {
      res.redirect(`${pathPrefix}/doc/index.html`)
    })
    fastifyInstance.get(`${pathPrefix}/doc/:v/schema.json`, (req, reply) => {
      const v = (req.params as Record<string, string>).v
      const version = Number(v.replace('v', ''))
      if (Number.isNaN(version) || !Number.isInteger(version) || version < 1 || version > api.version) {
        reply.status(404)
        return { error: 'Invalid version', minVersion: `v1`, maxVersion: `v${api.version}` }
      }
      return rest.openapi.fromModule({ module, api, version })
    })
  }
  attachRestMethods({ module, api, fastifyInstance, context, pathPrefix, error })
}
