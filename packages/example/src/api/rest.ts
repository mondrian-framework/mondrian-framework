import { module } from '../core'
import { InvalidJwtError } from '../core/errors'
import { rest } from '@mondrian-framework/rest'
import { server as restServer } from '@mondrian-framework/rest-fastify'

const api: rest.Api<module.Functions> = {
  version: 2,
  functions: {
    register: [
      { method: 'post', path: '/subscribe', version: { min: 2 } },
      { method: 'put', path: '/user', version: { max: 1 } },
    ],
    login: { method: 'post', path: '/login', errorCodes: { invalidLogin: 401 } },
    follow: { method: 'put', path: '/user/{userId}/follow' },
    writePost: { method: 'post', path: '/post' },
    readPosts: [{ method: 'get', path: '/user/{userId}/posts' }],
    likePost: { method: 'put', path: '/post/{postId}/like' },
  },
  options: { introspection: true },
}

export function startServer(server: any) {
  restServer.start({
    server,
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
