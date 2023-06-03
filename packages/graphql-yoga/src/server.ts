import { ErrorHandler, GraphqlApi, generateGraphqlSchema } from '@mondrian-framework/graphql'
import { Types } from '@mondrian-framework/model'
import { Functions, Module } from '@mondrian-framework/module'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GraphQLResolveInfo } from 'graphql'
import { createYoga } from 'graphql-yoga'

type ServerContext = { fastify: { request: FastifyRequest; reply: FastifyReply } }

export function serve<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>, CI>({
  module,
  server,
  api,
  context,
  error,
}: {
  module: Module<T, F, CI>
  api: GraphqlApi<F>
  server: FastifyInstance
  context: (serve: ServerContext, info: GraphQLResolveInfo) => Promise<CI>
  error?: ErrorHandler<F, ServerContext>
}): void {
  const schema = generateGraphqlSchema<ServerContext, CI>({
    module,
    api,
    context,
    setHeader: (ctx, name, value) => {
      ctx.fastify.reply.header(name, value)
    },
    error,
  })
  const yoga = createYoga({
    schema,
    plugins: api.options?.introspection ? [] : [], //TODO: disable introspection
    logging: true,
  })
  server.route({
    url: api.options?.pathPrefix ?? `/${module.name.toLocaleLowerCase()}/graphql`,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (request, reply) => {
      const ctx = { request, reply }
      const response = await yoga.handleNodeRequest(request, { fastify: ctx })
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      reply.status(response.status)
      reply.send(response.body)
      return reply
    },
  })
}
