import { module } from '../core'
import { graphql } from '@mondrian-framework/graphql'
import { serveWithFastify as serve } from '@mondrian-framework/graphql-yoga'
import { exception } from '@mondrian-framework/module'
import { FastifyInstance } from 'fastify'

const api = graphql.build({
  module: module,
  functions: {
    register: { type: 'mutation' },
    login: { type: 'query' },
    getUsers: { type: 'query' },
    follow: { type: 'mutation' },
    writePost: { type: 'mutation', name: 'write' },
    readPosts: { type: 'query', name: 'posts' },
    likePost: { type: 'mutation', name: 'like' },
  },
})

export function serveGraphql(server: FastifyInstance) {
  serve({
    server,
    api,
    context: async ({ request }) => ({
      authorization: request.headers.authorization,
      ip: request.ip,
    }),
    errorHandler: async ({ error, logger }) => {
      if (error instanceof exception.UnauthorizedAccess) {
        return { message: 'Unauthorized access', options: { extensions: { info: error.error } } }
      }
      if (error instanceof Error && process.env.ENVIRONMENT !== 'development') {
        logger.logError(error.message)
        //Hide error details
        return { message: 'Internal server error' }
      }
    },
    options: { introspection: true },
  })
}
