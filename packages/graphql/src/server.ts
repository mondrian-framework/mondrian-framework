import { buildGraphqlSchema } from './graphl-builder'
import { Types } from '@mondrian-framework/model'
import { Functions, Module } from '@mondrian-framework/module'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GraphQLResolveInfo } from 'graphql'
import { createYoga } from 'graphql-yoga'

export type GraphqlFunctionSpecs = { type: 'query' | 'mutation'; name?: string; inputName?: string }
export type ModuleGraphqlApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: GraphqlFunctionSpecs | readonly GraphqlFunctionSpecs[]
  }
  options?: {
    introspection?: boolean
    pathPrefix?: string
  }
}

export function serve<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>, CI>({
  module,
  server,
  api,
  context,
}: {
  module: Module<T, F, CI>
  api: ModuleGraphqlApi<F>
  server: FastifyInstance
  context: (args: { request: FastifyRequest; info: GraphQLResolveInfo }) => Promise<CI>
}): void {
  const yoga = createYoga<{ fastify: { request: FastifyRequest; reply: FastifyReply } }>({
    schema: buildGraphqlSchema({ module, api, context }),
    plugins: api.options?.introspection ? [] : [], //TODO: disable introspection
    logging: true,
  })
  server.route({
    url: api.options?.pathPrefix ?? `/${module.name.toLocaleLowerCase()}/graphql`,
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
