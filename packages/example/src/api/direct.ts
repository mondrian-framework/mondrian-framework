import { module } from '../core'
import { serveWithFastify as serve, direct } from '@mondrian-framework/direct'
import { FastifyInstance } from 'fastify'

const api = direct.build({ module, exclusions: {} })

export function serveDirect(server: FastifyInstance) {
  serve({
    server,
    api,
    context: async ({ request }) => ({
      authorization: request.headers.authorization,
      ip: request.ip,
    }),
    options: {
      decodeOptions: {
        errorReportingStrategy: 'allErrors',
        fieldStrictness: 'expectExactFields',
        typeCastingStrategy: 'expectExactTypes',
      },
      introspection: true,
    },
  })
}
