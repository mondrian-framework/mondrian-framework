import { ServerContext } from './server'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { http, isArray } from '@mondrian-framework/utils'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function attachRestMethods<Fs extends functions.FunctionImplementations>({
  server,
  api,
  context,
  pathPrefix,
  onError,
}: {
  server: FastifyInstance
  api: rest.Api<Fs>
  context: (serverContext: ServerContext) => Promise<module.FunctionsToContextInput<Fs>>
  pathPrefix: string
  onError?: rest.ErrorHandler<Fs, ServerContext>
}): void {
  for (const [functionName, functionBody] of Object.entries(api.module.functions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const paths = utils
        .getPathsFromSpecification({ functionName, specification, prefix: pathPrefix, maxVersion: api.version })
        .map((p) => p.replace(/{(.*?)}/g, ':$1'))
      const restHandler = rest.handler.fromFunction<Fs, ServerContext>({
        module: api.module,
        context,
        specification,
        functionName,
        functionBody,
        onError,
        api: api as any,
      })
      const fastifyHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await restHandler({
          serverContext: { request, reply },
          request: {
            body: request.body,
            headers: request.headers,
            method: request.method.toLowerCase() as http.Method,
            params: request.params as Record<string, string>,
            query: request.query as Record<string, string>,
            route: request.routeOptions.url ?? '',
          },
        })
        reply.status(result.status)
        if (result.headers) {
          reply.headers(result.headers)
        }
        return result.body
      }
      for (const path of paths) {
        server[specification.method ?? utils.methodFromOptions(functionBody.options)](path, fastifyHandler)
      }
    }
  }
}
