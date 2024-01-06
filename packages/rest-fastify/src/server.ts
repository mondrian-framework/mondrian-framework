import { attachRestMethods } from './methods'
import { fastifyStatic } from '@fastify/static'
import { functions } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { replaceLast } from '@mondrian-framework/utils'
import { FastifyReply, FastifyRequest } from 'fastify'
import { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export type ServerContext = { request: FastifyRequest; reply: FastifyReply }

export function serve<Fs extends functions.Functions, E extends functions.ErrorType, ContextInput>({
  api,
  server,
  context,
  error,
  ...args
}: {
  api: rest.Api<Fs, E, ContextInput>
  server: FastifyInstance
  context: (serverContext: ServerContext) => Promise<ContextInput>
  error?: rest.ErrorHandler<Fs, ServerContext>
  options?: Partial<rest.ServeOptions>
}): void {
  const options = { ...rest.DEFAULT_SERVE_OPTIONS, ...args.options }
  const pathPrefix = api.options?.pathPrefix ?? '/api'
  if (options.introspection) {
    const introspectionPath = options.introspection.path.endsWith('/')
      ? options.introspection.path
      : `${options.introspection.path}/`
    server.register(fastifyStatic, {
      root: getAbsoluteFSPath(),
      prefix: introspectionPath,
    })
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${introspectionPath}v${api.version}/schema.json`)
    server.get(`${introspectionPath}swagger-initializer.js`, (_, res) => res.send(indexContent))
    server.get(introspectionPath, (_, res) => {
      res.redirect(`${introspectionPath}index.html`)
    })
    if (introspectionPath !== '/') {
      server.get(replaceLast(introspectionPath, '/', ''), (_, res) => {
        res.redirect(`${introspectionPath}index.html`)
      })
    }
    const cache: Map<string, unknown> = new Map()
    server.get(`${introspectionPath}:v/schema.json`, (req, reply) => {
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
      const schema = rest.openapi.fromModule({ api, version })
      cache.set(v, schema)
      return schema
    })
  }
  attachRestMethods({ api, server, context, pathPrefix, error })
}
