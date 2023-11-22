import { attachRestMethods } from './methods'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import fs from 'fs'
import lambdaApi, { Request, Response } from 'lambda-api'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export type Context = { lambdaApi: { request: Request; response: Response } }

export function build<const Fs extends functions.Functions, const ContextInput>({
  api,
  context,
  error,
}: {
  api: rest.Api<Fs, ContextInput>
  context: (serverContext: Context) => Promise<ContextInput>
  error?: rest.ErrorHandler<Fs, Context>
}): APIGatewayProxyHandlerV2 {
  utils.assertApiValidity(api)
  const server = lambdaApi()
  if (api.options?.introspection) {
    const introspectionPath =
      (typeof api.options.introspection === 'object' ? api.options.introspection?.path : null) ?? `/openapi`
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${introspectionPath}/v${api.version}/schema.json`)
    server.get(`${introspectionPath}/swagger-initializer.js`, (req: Request, res: Response) => res.send(indexContent))
    server.get(`${introspectionPath}`, (req: Request, res: Response) => {
      res.redirect(`${introspectionPath}/index.html`)
    })
    const cache: Map<string, unknown> = new Map()
    server.get(`${introspectionPath}/:v/schema.json`, (req: Request, res: Response) => {
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
      const schema = rest.openapi.fromModule({ api, version, module: api.module })
      cache.set(v, schema)
      return schema
    })
    // file deepcode ignore NoRateLimitingForExpensiveWebOperation: could disable this by disabling introspection in production environment
    server.get(`${introspectionPath}/*`, (req: Request, res: Response) => {
      //avoid path traversal
      if (req.path.match(/\.\.\//g) !== null) {
        res.status(404)
        return
      }
      const file = `${getAbsoluteFSPath()}/${req.path}`
      const path = file.replace(`${introspectionPath}/`, '')
      res.sendFile(path)
    })
  }
  attachRestMethods({ api, context, server, error })
  return (event, context) => server.run(event, context)
}
