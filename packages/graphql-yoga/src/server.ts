import { graphql } from '@mondrian-framework/graphql'
import { functions, module } from '@mondrian-framework/module'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin } from 'graphql-yoga'

export type Context = { fastify: { request: FastifyRequest; reply: FastifyReply } }

export function start<const Fs extends functions.Functions, const ContextInput>({
  module,
  server,
  api,
  context,
  errorHandler,
}: {
  module: module.Module<Fs, ContextInput>
  api: graphql.Api<Fs>
  server: FastifyInstance
  context: (serve: Context, info: GraphQLResolveInfo) => Promise<ContextInput>
  errorHandler?: graphql.ErrorHandler<Fs, Context>
}): void {
  const schema = graphql.fromModule({
    module,
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
