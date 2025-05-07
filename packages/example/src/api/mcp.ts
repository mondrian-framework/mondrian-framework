import { module } from '../core'
import { build, buildHttpStreamableHandler } from '@mondrian-framework/mcp'
import { FastifyInstance } from 'fastify'

const api = build({
  module,
  functions: {
    getUsers: { name: 'read-users' },
    readPosts: { name: 'read-posts' },
    writePost: { name: 'write-post' },
    follow: { name: 'follow-user' },
    likePost: { name: 'like-post' },
  },
  options: { path: '/mcp' },
})

export function serveMcp(server: FastifyInstance) {
  const handler = buildHttpStreamableHandler({
    api,
    context: async (request, response, authInfo) => ({ authorization: request.headers.authorization, ip: '0.0.0.0' }),
  })
  server.post(api.options?.path ?? '/mcp', async (request, reply) => {
    await handler(request.raw, reply.raw, request.body)
  })

  server.get(api.options?.path ?? '/mcp', async (request, reply) => {
    console.log('Received GET MCP request')
    reply.status(405).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    })
  })

  server.delete(api.options?.path ?? '/mcp', async (request, reply) => {
    console.log('Received GET MCP request')
    reply.status(405).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    })
  })
}
