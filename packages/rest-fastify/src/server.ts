import { attachRestMethods } from './methods'
import { functions, module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { replaceLast } from '@mondrian-framework/utils'
import { FastifyReply, FastifyRequest } from 'fastify'
import { FastifyInstance } from 'fastify'

export type ServerContext = { request: FastifyRequest; reply: FastifyReply }

export function serve<Fs extends functions.FunctionImplementations>({
  api,
  server,
  context,
  onError,
  ...args
}: {
  api: rest.Api<Fs>
  server: FastifyInstance
  context: (serverContext: ServerContext) => Promise<module.FunctionsToContextInput<Fs>>
  onError?: rest.ErrorHandler<Fs, ServerContext>
  options?: rest.ServeOptions
}): void {
  const options = { ...rest.DEFAULT_SERVE_OPTIONS, ...args.options }
  const pathPrefix = api.options?.pathPrefix ?? '/api'
  if (options.introspection) {
    const introspectionPath = options.introspection.path.endsWith('/')
      ? options.introspection.path
      : `${options.introspection.path}/`
    if (options.introspection.ui !== 'none') {
      server.get(`${introspectionPath}index.html`, (_, res) => {
        res.header('Content-Type', 'text/html')
        res.send(rest.openapi.ui({ api, options }))
      })
      if (introspectionPath !== '/') {
        server.get(replaceLast(introspectionPath, '/', ''), (_, res) => {
          res.redirect(`${introspectionPath}index.html`)
        })
      }
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
  attachRestMethods({ api, server, context, pathPrefix, onError })
}
