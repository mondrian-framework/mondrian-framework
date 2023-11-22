import { attachRestMethods } from './methods'
import { fastifyStatic } from '@fastify/static'
import { functions } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { FastifyReply, FastifyRequest } from 'fastify'
import { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export type Context = { fastify: { request: FastifyRequest; reply: FastifyReply } }

export function serve<const Fs extends functions.Functions, ContextInput>({
  api,
  server,
  context,
  error,
}: {
  api: rest.Api<Fs, ContextInput>
  server: FastifyInstance
  context: (serverContext: Context) => Promise<ContextInput>
  error?: rest.ErrorHandler<Fs, Context>
}): void {
  const pathPrefix = api.options?.pathPrefix ?? '/api'
  if (api.options?.introspection) {
    const introspectionPath =
      (typeof api.options.introspection === 'object' ? api.options.introspection?.path : null) ?? `/openapi`
    server.register(fastifyStatic, {
      root: getAbsoluteFSPath(),
      prefix: introspectionPath,
    })
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${introspectionPath}/v${api.version}/schema.json`)
    server.get(`${introspectionPath}/swagger-initializer.js`, (req, res) => res.send(indexContent))
    server.get(`${introspectionPath}`, (req, res) => {
      res.redirect(`${introspectionPath}/index.html`)
    })
    const cache: Map<string, unknown> = new Map()
    server.get(`${introspectionPath}/:v/schema.json`, (req, reply) => {
      const v = (req.params as Record<string, string>).v
      const version = Number(v.replace('v', ''))
      if (Number.isNaN(version) || !Number.isInteger(version) || version < 1 || version > api.version) {
        reply.status(404)
        return { error: 'Invalid version', minVersion: `v1`, maxVersion: `v${api.version}` }
      }
      const cachedSchema = cache.get(v)
      if (cachedSchema) {
        return cachedSchema
      }
      const schema = rest.openapi.fromModule({ api, version, module: api.module })
      cache.set(v, schema)
      return schema
    })
  }
  attachRestMethods({ api, server, context, pathPrefix, error })
}
