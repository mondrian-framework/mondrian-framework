import { attachRestMethods } from './methods'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { replaceLast } from '@mondrian-framework/utils'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import fs from 'fs'
import lambdaApi, { Request, Response, API } from 'lambda-api'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export type ServerContext = { lambdaApi: { request: Request; response: Response } }

export function build<Fs extends functions.Functions>({
  api,
  context,
  error,
  customize,
  ...args
}: {
  api: rest.Api<Fs>
  context: (serverContext: ServerContext) => Promise<module.FunctionsToContextInput<Fs>>
  error?: rest.ErrorHandler<Fs, ServerContext>
  options: Partial<rest.ServeOptions>
  customize?: (server: API) => void
}): APIGatewayProxyHandlerV2 {
  utils.assertApiValidity(api)
  const server = lambdaApi({ base: '' })
  const options = { ...rest.DEFAULT_SERVE_OPTIONS, ...args.options }
  if (options.introspection) {
    const introspectionPath = options.introspection.path.endsWith('/')
      ? options.introspection.path
      : `${options.introspection.path}/`
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${introspectionPath}v${api.version}/schema.json`)
    server.get(`${introspectionPath}swagger-initializer.js`, (_: Request, res: Response) => res.send(indexContent))
    server.get(`${introspectionPath}`, (_: Request, res: Response) => {
      res.redirect(`${introspectionPath}index.html`)
    })
    const cache: Map<string, unknown> = new Map()
    server.get(`${introspectionPath}:v/schema.json`, (req: Request, res: Response) => {
      const v = (req.params as Record<string, string>).v
      const version = Number(v.replace('v', ''))
      if (Number.isNaN(version) || !Number.isInteger(version) || version < 1 || version > api.version) {
        res.status(404)
        return { error: 'Invalid version', minVersion: `v1`, maxVersion: `v${api.version}` }
      }
      const cachedSchema = cache.get(v)
      if (cachedSchema) {
        return cachedSchema
      }
      const schema = rest.openapi.fromModule({ api, version })
      cache.set(v, schema)
      return schema
    })
    // file deepcode ignore NoRateLimitingForExpensiveWebOperation: could disable this by disabling introspection in production environment
    server.get(`${introspectionPath}*`, (req: Request, res: Response) => {
      //avoid path traversal
      if (req.path.match(/\.\.\//g) !== null) {
        res.status(404)
        return
      }
      const file = `${getAbsoluteFSPath()}/${req.path}`
      const path = replaceLast(file, `${introspectionPath}`, '')
      res.sendFile(path)
    })
  }
  attachRestMethods({ api, context, server, error })
  if (customize) {
    customize(server)
  }
  return (event, context) => server.run(event, context)
}
