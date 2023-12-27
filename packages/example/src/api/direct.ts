import { module } from '../core'
import { serveWithFastify as serve } from '@mondrian-framework/direct'
import { FastifyInstance } from 'fastify'

export function serveDirect(server: FastifyInstance) {
  serve({
    server,
    module: module.instance,
    context: async ({ request }) => ({
      authorization: request.headers.authorization,
      ip: request.ip,
    }),
  })
}
