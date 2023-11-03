import { module } from '../core'
import { InvalidJwtError } from '../core/errors'
import { rest } from '@mondrian-framework/rest'
import { serve } from '@mondrian-framework/rest-fastify'
import { FastifyInstance } from 'fastify'

const api: rest.Api<module.Functions> = {
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
  options: { introspection: true },
}

export function startServer(fastifyInstance: FastifyInstance) {
  serve({
    fastifyInstance,
    module: module.instance,
    api,
    context: async ({ fastify }) => ({
      authorization: fastify.request.headers.authorization,
      ip: fastify.request.ip,
    }),
    async error({ error, logger }) {
      if (error instanceof InvalidJwtError) {
        return { status: 400, body: error.message }
      }
      if (error instanceof Error && process.env.ENVIRONMENT !== 'development') {
        logger.logError(error.message)
        //Hide error details
        return { status: 500, body: 'Internal server error' }
      }
    },
  })
}
