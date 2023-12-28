import { graphql } from '@mondrian-framework/graphql'
import { functions } from '@mondrian-framework/module'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin, YogaServerOptions } from 'graphql-yoga'

export type ServerContext = { request: FastifyRequest; reply: FastifyReply }

export function serveWithFastify<const Fs extends functions.Functions, const ContextInput>({
  server,
  api,
  context,
  errorHandler,
  options,
}: {
  api: graphql.Api<Fs, ContextInput>
  server: FastifyInstance
  context: (serverContext: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  errorHandler?: graphql.ErrorHandler<Fs, ServerContext>
  options?: Omit<YogaServerOptions<ServerContext, ContextInput>, 'schema' | 'context' | 'graphqlEndpoint'>
}): void {
  const schema = graphql.fromModule({
    api,
    context,
    setHeader: ({ reply }, name, value) => {
      reply.header(name, value)
    },
    errorHandler,
  })
  const disableIntrospection: Plugin = {
    onValidate({ addValidationRule }) {
      addValidationRule(NoSchemaIntrospectionCustomRule)
    },
  }
  const yoga = createYoga({
    ...options,
    schema,
    plugins: api.options?.introspection ? options?.plugins : [disableIntrospection, ...(options?.plugins ?? [])],
    graphqlEndpoint: api.options?.path,
  })
  server.route({
    url: api.options?.path ?? `/graphql`,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (request, reply) => {
      const ctx = { request, reply }
      const response = await yoga.handleNodeRequest(request, ctx)
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      reply.status(response.status)
      reply.send(response.body)
      return reply
    },
  })
}
