import { module } from '../core'
import { graphql } from '@mondrian-framework/graphql'
import { serve } from '@mondrian-framework/graphql-yoga'
import { FastifyInstance } from 'fastify'

const api = graphql.build({
  module: module.instance,
  functions: {
    register: { type: 'mutation' },
    login: { type: 'query' },
    follow: { type: 'mutation' },
    writePost: { type: 'mutation' },
    readPosts: { type: 'query', name: 'posts' },
    likePost: { type: 'mutation' },
  },
  options: { introspection: true },
})

export function startServer(server: FastifyInstance) {
  serve({
    server,
    api,
    context: async ({ fastify }) => ({
      authorization: fastify.request.headers.authorization,
      ip: fastify.request.ip,
    }),
  })
}
