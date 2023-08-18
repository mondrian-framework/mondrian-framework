import { ServerContext } from './server'
import { functions, module } from '@mondrian-framework/module'
import { api, handler, utils } from '@mondrian-framework/rest'
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
  api: api.RestApi<Fs>
  context: (serverContext: ServerContext) => Promise<ContextInput>
  pathPrefix: string
  error?: api.ErrorHandler<Fs, ServerContext>
}): void {
  const maxVersion = utils.getMaxApiVersion(api)
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = utils.getPathFromSpecification(functionName, specification, pathPrefix).replace(/{(.*?)}/g, ':$1')
      const generateHandler = handler.fromFunction<Fs, ServerContext, ContextInput>({
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
            method: request.method.toLowerCase() as api.RestMethod,
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
