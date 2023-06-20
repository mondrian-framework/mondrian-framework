import { attachRestMethods } from './methods'
import { ServerContext } from './utils'
import { Functions, Module } from '@mondrian-framework/module'
import { ErrorHandler, RestApi, generateOpenapiDocument, getMaxVersion } from '@mondrian-framework/rest'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import fs from 'fs'
import lambdaApi, { Request, Response } from 'lambda-api'
import path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

export function handler<const F extends Functions, CI>({
  module,
  api,
  context,
  error,
}: {
  module: Module<F, CI>
  api: RestApi<F>
  context: (serverContext: ServerContext) => Promise<CI>
  error?: ErrorHandler<F, ServerContext>
}): APIGatewayProxyHandlerV2 {
  const pathPrefix = `/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`
  const server = lambdaApi({ base: pathPrefix })
  const globalMaxVersion = getMaxVersion(api)
  if (api.options?.introspection) {
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${pathPrefix}/doc/v${globalMaxVersion}/schema.json`)
    server.get(`/doc/swagger-initializer.js`, (req: Request, res: Response) => res.send(indexContent))
    server.get(`/doc`, (req: Request, res: Response) => {
      res.redirect(`${pathPrefix}/doc/index.html`)
    })
    server.get(`/doc/:v/schema.json`, (req: Request, res: Response) => {
      const v = (req.params as Record<string, string>).v
      const version = Number(v.replace('v', ''))
      if (Number.isNaN(version) || version < 1 || version > globalMaxVersion) {
        res.status(404)
        return { error: 'Invalid version', minVersion: `v1`, maxVersion: `v${globalMaxVersion}` }
      }
      return generateOpenapiDocument({ module, api, version })
    })
    server.get(`/doc/*`, (req: Request, res: Response) => {
      const file = `${getAbsoluteFSPath()}/${req.path}`
      const path = file.replace(`${pathPrefix}/doc/`, '')
      res.sendFile(path)
    })
  }
  attachRestMethods({ module, api, context, server, error })
  return (event, context) => server.run(event, context)
}
