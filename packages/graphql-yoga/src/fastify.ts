import { graphql } from '@mondrian-framework/graphql'
import { functions, module } from '@mondrian-framework/module'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin, YogaServerOptions } from 'graphql-yoga'

export type ServerContext = { fastify: { request: FastifyRequest; reply: FastifyReply } }

export function serveWithFastify<Fs extends functions.FunctionImplementations>({
  server,
  api,
  context,
  onError,
  ...args
}: {
  api: graphql.Api<Fs>
  server: FastifyInstance
  context: (serverContext: ServerContext, info: GraphQLResolveInfo) => Promise<module.FunctionsToContextInput<Fs>>
  onError?: graphql.ErrorHandler<Fs, ServerContext>
  options?: Omit<
    YogaServerOptions<ServerContext, module.FunctionsToContextInput<Fs>>,
    'schema' | 'context' | 'graphqlEndpoint'
  > &
    graphql.ServeOptions
}): void {
  const schema = graphql.fromModule({
    api,
    context,
    onError,
  })
  const disableIntrospection: Plugin = {
    onValidate({ addValidationRule }) {
      addValidationRule(NoSchemaIntrospectionCustomRule)
    },
  }
  const options = { ...graphql.DEFAULT_SERVE_OPTIONS, ...args.options }
  const yoga = createYoga({
    ...options,
    schema,
    plugins: options.introspection ? options?.plugins : [disableIntrospection, ...(options?.plugins ?? [])],
    graphqlEndpoint: api.options?.path,
  })
  server.route({
    url: api.options?.path ?? `/graphql`,
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
