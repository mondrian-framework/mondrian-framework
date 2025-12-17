import { module } from './impl/module'
import { restAPI } from './interface'
import { handler as h, Request, Response } from '@mondrian-framework/aws-lambda-rest'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

export const handler: APIGatewayProxyHandlerV2 = h.build({
  api: { ...restAPI, module },
  context: async () => ({}),
  options: { introspection: { path: '/specs', ui: 'swagger' } },
  customize: (server) => {
    server.get('/', (_: Request, res: Response) => {
      res.redirect(`/specs/index.html`)
    })
  },
})
