import { ServerContext } from './utils'
import { Functions, GenericModule } from '@mondrian-framework/module'
import {
  ErrorHandler,
  RestApi,
  RestMethod,
  getMaxVersion,
  handleRestRequest,
  pathFromSpecification,
} from '@mondrian-framework/rest'
import { isArray } from '@mondrian-framework/utils'
import { API, HandlerFunction, METHODS } from 'lambda-api'

export function attachRestMethods<ContextInput>({
  module,
  server,
  api,
  context,
  error,
}: {
  module: GenericModule
  server: API
  api: RestApi<Functions>
  context: (serverContext: ServerContext) => Promise<ContextInput>
  error?: ErrorHandler<Functions, ServerContext>
}): void {
  const maxVersion = getMaxVersion(api)
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = pathFromSpecification(functionName, specification, '')
      const handler: HandlerFunction = async (request, response) => {
        const result = await handleRestRequest<ServerContext, ContextInput>({
          module,
          context,
          specification,
          functionName,
          functionBody,
          globalMaxVersion: maxVersion,
          error,
          serverContext: { lambdaApi: { request, response } },
          request: {
            body: request.body as string,
            headers: request.headers,
            method: request.method.toLowerCase() as RestMethod,
            params: request.params as Record<string, string>,
            query: request.query as Record<string, string>,
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
      server.METHOD(specification.method.toUpperCase() as METHODS, path, handler)
    }
  }
}
