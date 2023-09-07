import { newFakeInMemoryDB } from './fakeDB'
import { loginUser, registerUser } from './user'
import { module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { server as restServer } from '@mondrian-framework/rest-fastify'

type ExposedFunctions = {
  loginUser: typeof loginUser
  registerUser: typeof registerUser
}

export const api: rest.Api<ExposedFunctions> = {
  version: 100,
  functions: {
    registerUser: [
      { method: 'post', path: '/subscribe/{email}', version: { max: 1 } },
      { method: 'put', path: '/register', version: { min: 2 } },
    ],
    loginUser: { method: 'get', version: { min: 1 } },
  },
  options: { introspection: true },
}

const db = newFakeInMemoryDB()

const restModule = module.build({
  name: 'reddit',
  version: '2.0.0',
  functions: { registerUser, loginUser },
  context: async () => db,
})

export function startServer(server: any) {
  restServer.start({
    server,
    module: restModule,
    api,
    context: async ({ fastify }) => ({ jwt: fastify.request.headers.authorization }),
    async error({ error, logger, functionName }) {
      if (error instanceof Error) {
        logger.logError(error.message)
        if (functionName === 'loginUser') {
          return { status: 400, body: 'Unauthorized' }
        } else {
          return { status: 400, body: 'Bad request' }
        }
      }
    },
  })
}
