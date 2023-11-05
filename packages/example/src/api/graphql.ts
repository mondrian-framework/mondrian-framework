import { module } from '../core'
import { InvalidJwtError } from '../core/errors'
import { graphql } from '@mondrian-framework/graphql'
import { server as graphqlServer } from '@mondrian-framework/graphql-yoga'

const api: graphql.Api<module.Functions> = {
  functions: {
    register: { type: 'mutation' },
    login: { type: 'query' },
    follow: { type: 'mutation' },
    writePost: { type: 'mutation' },
    readPosts: { type: 'query', name: 'posts' },
    likePost: { type: 'mutation' },
  },
  options: { introspection: true },
}

export function startServer(server: any) {
  graphqlServer.start({
    server,
    module: module.instance,
    api,
    context: async ({ fastify }) => ({
      authorization: fastify.request.headers.authorization,
      ip: fastify.request.ip,
    }),
  })
}
