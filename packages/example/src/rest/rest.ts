import { adapters } from '../adapters'
import { posts, users } from '../core'
import { module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { server as restServer } from '@mondrian-framework/rest-fastify'
import { PrismaClient } from '@prisma/client'

const prismaClient = new PrismaClient()
const context = adapters.prisma(prismaClient)

type Functions = typeof functions
const functions = {
  register: users.actions.register,
  login: users.actions.login,
  write: posts.actions.write,
  read: posts.actions.read,
}

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
    login: { method: 'get', version: { min: 1 }, errorCodes: { invalidLogin: 401, internalError: 500 } },
    write: { method: 'post', path: '/posts/write' },
    read: { method: 'get', path: '/posts/read/{authorId}' },
  },
  options: { introspection: true },
}

export function startServer(server: any) {
  restServer.start({
    server,
    module: redditModule,
    api,
    context: async ({ fastify }) => ({ jwt: fastify.request.headers.authorization }),
    async error({ error, logger }) {
      if (error instanceof Error) {
        logger.logError(error.message)
        return { status: 500, body: 'Internal server error' }
      }
    },
  })
}
