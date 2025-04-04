import { module } from '../core'
import mcp from '@mondrian-framework/mcp'
import { FastifyInstance } from 'fastify'

const api = mcp.build({
  module,
  functions: {
    getUsers: { name: 'get-users', type: 'tool' },
    readPosts: { name: 'get-posts', type: 'tool' },

    writePost: { name: 'write-post', type: 'tool' },
    follow: { name: 'follow-user', type: 'tool' },

    likePost: { name: 'like-post', type: 'tool' },
  },
  options: {
    path: '/mcp',
  },
})

export function serveMcp(server: FastifyInstance) {
  const handler = mcp.handler({ api })
  server.post(api.options?.path ?? '/mcp', async (request, reply) => {
    await handler(request.raw, reply.raw)
  })
}
