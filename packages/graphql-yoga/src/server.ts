import { graphql } from '@mondrian-framework/graphql'
import { functions } from '@mondrian-framework/module'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin } from 'graphql-yoga'

export type ServerContext = { fastify: { request: FastifyRequest; reply: FastifyReply } }

export function serve<const Fs extends functions.Functions, const ContextInput>({
  server,
  api,
  context,
  errorHandler,
}: {
  api: graphql.Api<Fs, ContextInput>
  server: FastifyInstance
  context: (serverContext: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  errorHandler?: graphql.ErrorHandler<Fs, ServerContext>
}): void {
  const schema = graphql.fromModule({
    api,
    context,
    setHeader: (ctx, name, value) => {
      ctx.fastify.reply.header(name, value)
    },
    errorHandler,
  })
  const disableIntrospection: Plugin = {
    onValidate({ addValidationRule }) {
      addValidationRule(NoSchemaIntrospectionCustomRule)
    },
  }
  const yoga = createYoga({
    schema,
    plugins: api.options?.introspection ? [] : [disableIntrospection],
    logging: true,
  })
  server.route({
    url: api.options?.pathPrefix ?? `/graphql`,
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
