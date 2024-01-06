import { graphql } from '@mondrian-framework/graphql'
import { functions } from '@mondrian-framework/module'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin, YogaServerOptions } from 'graphql-yoga'
import http from 'node:http'

export type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

export function createServer<Fs extends functions.Functions, E extends functions.ErrorType, const ContextInput>({
  api,
  context,
  errorHandler,
  ...args
}: {
  api: graphql.Api<Fs, E, ContextInput>
  context: (serverContext: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  errorHandler?: graphql.ErrorHandler<Fs, ServerContext>
  options?: Omit<YogaServerOptions<ServerContext, ContextInput>, 'schema' | 'context' | 'graphqlEndpoint'> &
    Partial<graphql.ServeOptions>
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
  const options = { ...graphql.DEFAULT_SERVE_OPTIONS, ...args.options }
  const yoga = createYoga<ServerContext>({
    ...options,
    schema,
    plugins: options.introspection ? options?.plugins : [disableIntrospection, ...(options?.plugins ?? [])],
    graphqlEndpoint: api.options?.path,
  })
  return http.createServer(yoga)
}
