import { ServeOptions, DEFAULT_SERVE_OPTIONS, Api } from '../api'
import { fromModule } from '../handler'
import { functions, module, serialization } from '@mondrian-framework/module'
import { http } from '@mondrian-framework/utils'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export type ServerContext = { request: FastifyRequest; reply: FastifyReply }

/**
 * Attachs a Direct server to a fastify instace.
 */
export function serveWithFastify<Fs extends functions.FunctionImplementations>({
  server,
  api,
  context,
  ...args
}: {
  api: Api<Fs, any>
  server: FastifyInstance
  context: (
    serverContext: ServerContext,
    metadata: Record<string, string> | undefined,
  ) => Promise<module.FunctionsToContextInput<Fs>>
  options?: Partial<ServeOptions>
}): void {
  const options = { ...DEFAULT_SERVE_OPTIONS, ...args.options }
  const handler = fromModule<Fs, ServerContext>({ api, context, options })
  const path = api.options?.path ?? '/mondrian'
  server.post(path, async (request, reply) => {
    const response = await handler({
      request: {
        body: request.body as string,
        headers: request.headers,
        method: request.method.toLowerCase() as http.Method,
        params: request.params as Record<string, string>,
        query: request.query as Record<string, string>,
        route: request.routeOptions.url,
      },
      serverContext: { request, reply },
    })
    reply.status(response.status)
    if (response.headers) {
      reply.headers(response.headers)
    }
    return response.body
  })
  if (options?.introspection) {
    const moduleSerialized = serialization.serialize(api.module)
    server.get(path, () => {
      return moduleSerialized
    })
  }
}
