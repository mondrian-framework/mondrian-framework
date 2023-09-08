import { adapters } from '../adapters'
import { users } from '../core'
import { module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { server as restServer } from '@mondrian-framework/rest-fastify'
import { PrismaClient } from '@prisma/client'

const prismaClient = new PrismaClient()
const context = adapters.prisma(prismaClient)

type Functions = typeof functions
const functions = { register: users.actions.register, login: users.actions.login }
export const redditModule = module.build({
  name: 'reddit',
  version: '2.0.0',
  functions,
  context: async () => context,
})

const api: rest.Api<Functions> = {
  version: 100,
  functions: {
    register: [
      { method: 'post', path: '/subscribe/{email}', version: { max: 1 } },
      { method: 'put', path: '/register', version: { min: 2 } },
    ],
    login: { method: 'get', version: { min: 1 } },
  },
  options: { introspection: true },
}

export function startServer(server: any) {
  restServer.start({
    server,
    module: redditModule,
    api,
    context: async ({ fastify }) => ({ jwt: fastify.request.headers.authorization }),
    async error({ error, logger, functionName }) {
      if (error instanceof Error) {
        logger.logError(error.message)
        if (functionName === 'login') {
          return { status: 400, body: 'Unauthorized' }
        } else {
          return { status: 400, body: 'Bad request' }
        }
      }
    },
  })
}
