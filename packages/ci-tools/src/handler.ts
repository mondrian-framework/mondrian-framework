import { module } from './impl/module'
import { restAPI } from './interface'
import { handler as h } from '@mondrian-framework/aws-lambda-rest'
import { Response, Request } from 'lambda-api'

export const handler = h.build({
  api: { ...restAPI, module },
  async context() {},
  options: { introspection: { path: '/specs' } },
  customize: (server) => {
    server.get('/', (_: Request, res: Response) => {
      res.redirect(`/specs/index.html`)
    })
  },
})
