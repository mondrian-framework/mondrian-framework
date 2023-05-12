import { Types } from '@mondrian/model'
import { Functions, Module, ModuleRunnerOptions } from '@mondrian/module'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createYoga } from 'graphql-yoga'
import { buildGraphqlSchema } from './graphl-builder'

export type GraphqlFunctionSpecs = { type: 'query' | 'mutation'; name?: string; inputName?: string }
export type ModuleGraphqlApi<F extends Functions> = {
  api: {
    [K in keyof F]: GraphqlFunctionSpecs
  }
  options?: ModuleRunnerOptions
}

export async function exposeModuleAsGraphQL<
  const T extends Types,
  const F extends Functions<keyof T extends string ? keyof T : string>,
>({
  module,
  server,
  graphql,
}: {
  module: Module<T, F>
  graphql: ModuleGraphqlApi<F>
  server: FastifyInstance
}): Promise<void> {
  const yoga = createYoga<{ fastify: { request: FastifyRequest; reply: FastifyReply } }>({
    schema: buildGraphqlSchema({ module, graphql }),
    plugins: graphql.options?.introspection ? [] : [], //TODO
    logging: true,
  })
  server.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (request, reply) => {
      const response = await yoga.handleNodeRequest(request, { fastify: { request, reply } })
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      reply.status(response.status)
      reply.send(response.body)
      return reply
    },
  })
}
