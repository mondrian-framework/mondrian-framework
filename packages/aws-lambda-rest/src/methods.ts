import { ServerContext } from './handler'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { http, isArray } from '@mondrian-framework/utils'
import { API, HandlerFunction, METHODS } from 'lambda-api'

export function attachRestMethods<Fs extends functions.Functions>({
  server,
  api,
  context,
  onError,
}: {
  server: API
  api: rest.Api<Fs>
  context: (serverContext: ServerContext) => Promise<module.FunctionsToContextInput<Fs>>
  onError?: rest.ErrorHandler<Fs, ServerContext>
}): void {
  for (const [functionName, functionBody] of Object.entries(api.module.functions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const paths = utils
        .getPathsFromSpecification({
          functionName,
          specification,
          prefix: api.options?.pathPrefix ?? '/api',
          maxVersion: api.version,
        })
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
      const lambdaApiHandler: HandlerFunction = async (request, response) => {
        const result = await restHandler({
          serverContext: { lambdaApi: { request, response } },
          request: {
            body: request.body,
            headers: request.headers,
            method: request.method.toLowerCase() as http.Method,
            params: request.params as Record<string, string>,
            query: request.query as Record<string, string>,
            route: request.route,
          },
        })
        response.status(result.status)
        if (result.headers) {
          for (const [key, value] of Object.entries(result.headers)) {
            response.header(key, value)
          }
        }
        return result.body
      }
      for (const path of paths) {
        server.METHOD(
          (specification.method?.toUpperCase() ?? utils.methodFromOptions(functionBody.options)) as METHODS,
          path,
          lambdaApiHandler,
        )
      }
    }
  }
}
