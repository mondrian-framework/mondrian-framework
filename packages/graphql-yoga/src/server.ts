import { graphql } from '@mondrian-framework/graphql'
import { functions } from '@mondrian-framework/module'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin, YogaServerOptions } from 'graphql-yoga'
import http from 'node:http'

export type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

export function createServer<const Fs extends functions.Functions, const ContextInput>({
  api,
  context,
  errorHandler,
  options,
}: {
  api: graphql.Api<Fs, ContextInput>
  context: (serverContext: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  errorHandler?: graphql.ErrorHandler<Fs, ServerContext>
  options?: Omit<YogaServerOptions<ServerContext, ContextInput>, 'schema' | 'context' | 'graphqlEndpoint'>
}): http.Server {
  const schema = graphql.fromModule({
    api,
    context,
    setHeader: (ctx, name, value) => ctx.res.setHeader(name, value),
    errorHandler,
  })
  const disableIntrospection: Plugin = {
    onValidate({ addValidationRule }) {
      addValidationRule(NoSchemaIntrospectionCustomRule)
    },
  }
  const yoga = createYoga<ServerContext>({
    ...options,
    schema,
    plugins: api.options?.introspection ? options?.plugins : [disableIntrospection, ...(options?.plugins ?? [])],
    graphqlEndpoint: api.options?.path,
  })
  return http.createServer(yoga)
}
