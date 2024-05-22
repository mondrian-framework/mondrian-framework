import { attachRestMethods } from './methods'
import { functions, module } from '@mondrian-framework/module'
import { rest, utils } from '@mondrian-framework/rest'
import { replaceLast } from '@mondrian-framework/utils'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import lambdaApi, { Request, Response, API } from 'lambda-api'

export type ServerContext = { lambdaApi: { request: Request; response: Response } }

export function build<Fs extends functions.FunctionImplementations>({
  api,
  context,
  onError,
  customize,
  ...args
}: {
  api: rest.Api<Fs>
  context: (serverContext: ServerContext) => Promise<module.FunctionsToContextInput<Fs>>
  onError?: rest.ErrorHandler<Fs, ServerContext>
  options?: rest.ServeOptions
  customize?: (server: API) => void
}): APIGatewayProxyHandlerV2 {
  utils.assertApiValidity(api)
  const server = lambdaApi({ base: '' })
  const options = { ...rest.DEFAULT_SERVE_OPTIONS, ...args.options }
  if (options.introspection) {
    const introspectionPath = options.introspection.path.endsWith('/')
      ? options.introspection.path
      : `${options.introspection.path}/`
    if (options.introspection.ui !== 'none') {
      const introspection = options.introspection
      server.get(`${introspectionPath}index.html`, (_: Request, res: Response) =>
        res.header('Content-Type', 'text/html').send(rest.openapi.ui({ api, options })),
      )
      server.get(`${introspectionPath}swagger.html`, (_: Request, res: Response) =>
        res
          .header('Content-Type', 'text/html')
          .send(rest.openapi.ui({ api, options: { introspection: { ...introspection, ui: 'swagger' } } })),
      )
      server.get(`${introspectionPath}redoc.html`, (_: Request, res: Response) =>
        res
          .header('Content-Type', 'text/html')
          .send(rest.openapi.ui({ api, options: { introspection: { ...introspection, ui: 'redoc' } } })),
      )
      server.get(`${introspectionPath}scalar.html`, (_: Request, res: Response) =>
        res
          .header('Content-Type', 'text/html')
          .send(rest.openapi.ui({ api, options: { introspection: { ...introspection, ui: 'scalar' } } })),
      )
      if (introspectionPath !== '/') {
        server.get(replaceLast(introspectionPath, '/', ''), (_: Request, res: Response) =>
          res.redirect(`${introspectionPath}index.html`),
        )
      }
    }

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
  }
  attachRestMethods({ api, context, server, onError })
  if (customize) {
    customize(server)
  }
  return (event, context) => server.run(event, context)
}
