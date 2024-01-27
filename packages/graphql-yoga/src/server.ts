import { graphql } from '@mondrian-framework/graphql'
import { functions, module } from '@mondrian-framework/module'
import { GraphQLResolveInfo } from 'graphql'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import { createYoga, Plugin, YogaServerOptions } from 'graphql-yoga'
import http from 'node:http'

export type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

export function createServer<Fs extends functions.FunctionImplementations>({
  api,
  context,
  onError,
  ...args
}: {
  api: graphql.Api<Fs>
  context: (serverContext: ServerContext, info: GraphQLResolveInfo) => Promise<module.FunctionsToContextInput<Fs>>
  onError?: graphql.ErrorHandler<Fs, ServerContext>
  options?: Omit<
    YogaServerOptions<ServerContext, module.FunctionsToContextInput<Fs>>,
    'schema' | 'context' | 'graphqlEndpoint'
  > &
    Partial<graphql.ServeOptions>
}): http.Server {
  const schema = graphql.fromModule({
    api,
    context,
    setHeader: (ctx, name, value) => ctx.res.setHeader(name, value),
    onError,
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
