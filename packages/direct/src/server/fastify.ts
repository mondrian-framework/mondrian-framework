import { fromModule } from '../handler'
import { functions, module } from '@mondrian-framework/module'
import { http } from '@mondrian-framework/utils'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export type ServerContext = { request: FastifyRequest; reply: FastifyReply }

export function serveWithFastify<const Fs extends functions.Functions, const ContextInput>({
  server,
  module,
  context,
  path,
}: {
  module: module.Module<Fs, ContextInput>
  server: FastifyInstance
  context: (serverContext: ServerContext, metadata: Record<string, string> | undefined) => Promise<ContextInput>
  path?: string
}): void {
  const handler = fromModule<Fs, ServerContext, ContextInput>({ module, context })
  server.post(path ?? '/mondrian', async (request, reply) => {
    const response = await handler({
      request: {
        body: request.body as string,
        headers: request.headers,
        method: request.method.toLowerCase() as http.Method,
        params: request.params as Record<string, string>,
        query: request.query as Record<string, string>,
        route: request.routeOptions.url,
      },
      serverContext: {
        request,
        reply,
      },
    })
    reply.status(response.status)
    if (response.headers) {
      reply.headers(response.headers)
    }
    return response.body
  })
}
