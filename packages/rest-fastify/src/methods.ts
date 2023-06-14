import { ServerContext } from './utils'
import { Functions, GenericModule } from '@mondrian-framework/module'
import {
  ErrorHandler,
  RestApi,
  RestMethod,
  getMaxVersion,
  generateRestRequestHandler,
  pathFromSpecification,
} from '@mondrian-framework/rest'
import { isArray } from '@mondrian-framework/utils'
import { FastifyInstance } from 'fastify'

export function attachRestMethods<ContextInput>({
  module,
  server,
  api,
  context,
  pathPrefix,
  error,
}: {
  module: GenericModule
  server: FastifyInstance
  api: RestApi<Functions>
  context: (serverContext: ServerContext) => Promise<ContextInput>
  pathPrefix: string
  error?: ErrorHandler<Functions, ServerContext>
}): void {
  const maxVersion = getMaxVersion(api)
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = pathFromSpecification(functionName, specification, pathPrefix).replace(/{(.*?)}/g, ':$1')
      const handler = generateRestRequestHandler<ServerContext, ContextInput>({
        module,
        context,
        specification,
        functionName,
        functionBody,
        globalMaxVersion: maxVersion,
        error,
      })
      server[specification.method](path, async (request, reply) => {
        const result = await handler({
          serverContext: { fastify: { request, reply } },
          request: {
            body: request.body as string,
            headers: request.headers,
            method: request.method.toLowerCase() as RestMethod,
            params: request.params as Record<string, string>,
            query: request.query as Record<string, string>,
          },
        })
        reply.status(result.status)
        if (result.headers) {
          reply.headers(result.headers)
        }
        return result.body
      })
    }
  }
}
