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
  module,
  api,
  context,
  error,
}: {
  module: module.Module<Fs, ContextInput>
  api: rest.Api<Fs>
  context: (serverContext: Context) => Promise<ContextInput>
  error?: rest.ErrorHandler<Fs, Context>
}): APIGatewayProxyHandlerV2 {
  utils.assertApiValidity(api)
  const pathPrefix = `/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`
  const server = lambdaApi({ base: pathPrefix })
  if (api.options?.introspection) {
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${pathPrefix}/doc/v${api.version}/schema.json`)
    server.get(`/doc/swagger-initializer.js`, (req: Request, res: Response) => res.send(indexContent))
    server.get(`/doc`, (req: Request, res: Response) => {
      res.redirect(`${pathPrefix}/doc/index.html`)
    })
    server.get(`/doc/:v/schema.json`, (req: Request, res: Response) => {
      const v = (req.params as Record<string, string>).v
      const version = Number(v.replace('v', ''))
      if (Number.isNaN(version) || !Number.isInteger(version) || version < 1 || version > api.version) {
        res.status(404)
        return { error: 'Invalid version', minVersion: `v1`, maxVersion: `v${api.version}` }
      }
      return rest.openapi.fromModule({ module, api, version })
    })
    // file deepcode ignore NoRateLimitingForExpensiveWebOperation: could disable this by disabling introspection in production environment
    server.get(`/doc/*`, (req: Request, res: Response) => {
      //avoid path traversal
      if (req.path.match(/\.\.\//g) !== null) {
        res.status(404)
        return
      }
      const file = `${getAbsoluteFSPath()}/${req.path}`
      const path = file.replace(`${pathPrefix}/doc/`, '')
      res.sendFile(path)
    })
  }
  attachRestMethods({ module, api, context, server, error })
  return (event, context) => server.run(event, context)
}
