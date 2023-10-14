import { server } from '.'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { isArray } from '@mondrian-framework/utils'
import { FastifyInstance } from 'fastify'

export function attachRestMethods<Fs extends functions.Functions, ContextInput>({
  module,
  server,
  api,
  context,
  pathPrefix,
  error,
}: {
  module: module.Module<Fs, ContextInput>
  server: FastifyInstance
  api: rest.Api<Fs>
  context: (serverContext: server.Context) => Promise<ContextInput>
  pathPrefix: string
  error?: rest.ErrorHandler<Fs, server.Context>
}): void {
  const maxVersion = utils.getMaxApiVersion(api)
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = utils.getPathFromSpecification(functionName, specification, pathPrefix).replace(/{(.*?)}/g, ':$1')
      const generateHandler = rest.handler.fromFunction<Fs, server.Context, ContextInput>({
        module,
        context,
        specification,
        functionName,
        functionBody,
        globalMaxVersion: maxVersion,
        error,
      })
      server[specification.method](path, async (request, reply) => {
        const result = await generateHandler({
          serverContext: { fastify: { request, reply } },
          request: {
            body: request.body as string,
            headers: request.headers,
            method: request.method.toLowerCase() as rest.Method,
            params: request.params as Record<string, string>,
            query: request.query as Record<string, string>,
            route: request.routeOptions.url,
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
