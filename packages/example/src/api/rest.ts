import { module } from '../core'
import { exception } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { serve } from '@mondrian-framework/rest-fastify'
import { FastifyInstance } from 'fastify'

const api = rest.build({
  module: module,
  version: 2,
  functions: {
    register: [
      { method: 'post', path: '/subscribe', version: { min: 2 } },
      { method: 'put', path: '/user', version: { max: 1 } },
    ],
    login: { method: 'post', path: '/login', errorCodes: { invalidLogin: 401 } },
    follow: { method: 'put', path: '/user/{userId}/follow', security: [{ loggedUser: [] }] },
    writePost: { method: 'post', path: '/post', security: [{ loggedUser: [] }] },
    readPosts: [{ method: 'get', path: '/user/{userId}/posts', security: [{ loggedUser: [] }] }],
    likePost: { method: 'put', path: '/post/{postId}/like', security: [{ loggedUser: [] }] },
  },
  securities: {
    loggedUser: { type: 'http', scheme: 'bearer' },
  },
  errorCodes: {
    unauthorized: 401,
    tooManyRequests: 429,
  },
  options: { endpoints: ['http://localhost:4000', 'http://127.0.0.1:4000'] },
})

export function serveRest(server: FastifyInstance) {
  serve({
    server,
    api,
    context: async ({ request }) => ({
      authorization: request.headers.authorization,
      ip: request.ip,
    }),
    async onError({ error, logger }) {
      if (error instanceof exception.UnauthorizedAccess) {
        return { status: 401, body: error.error }
      }
      if (error instanceof Error && process.env.ENVIRONMENT !== 'development') {
        logger.logError(error.message)
        //Hide error details
        return { status: 500, body: 'Internal server error' }
      }
    },
    options: { introspection: { path: '/openapi' } },
  })
}
