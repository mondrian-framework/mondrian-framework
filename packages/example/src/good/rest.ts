import { LoginUserContext, RegisterUserContext, User, loginUser, registerUser } from './user'
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

type Context = RegisterUserContext & LoginUserContext

function inMemoryDb(): Context {
  const idByUsernamePassword = new Map<[string, string], string>()
  const usersById = new Map<string, User>()
  let id = 1

  return {
    async addUser(email, password, firstName, lastName, metadata) {
      const userId = id++
      const newUser = { id: `${userId}`, email, password, firstName, lastName, metadata, posts: [] }
      idByUsernamePassword.set([email, password], `${userId}`)
      usersById.set(`${userId}`, newUser)
      console.log(`added user`, newUser)
      return newUser
    },

    async findUser(email, password) {
      return idByUsernamePassword.get([email, password])
    },

    async updateLoginTime(id, loginTime) {
      const user = usersById.get(id)
      if (user) {
        const updatedUser = { ...user, metadata: { ...user.metadata, lastLogin: loginTime } }
        usersById.set(id, updatedUser)
        return updatedUser
      } else {
        return undefined
      }
    },
  }
}

const db = inMemoryDb()
const restModule = module.build({
  name: 'reddit',
  version: '2.0.0',
  functions: { registerUser, loginUser },
  async context(): Promise<Context> {
    return db
  },
})

export function startServer(server: any) {
  restServer.start({
    server,
    module: restModule,
    api,
    context: async ({ fastify }) => {
      return { jwt: fastify.request.headers.authorization }
    },
    async error({ error, logger, functionName }) {
      if (error instanceof Error) {
        logger.logError(error.message)
        if (functionName === 'loginUser') {
          return { status: 400, body: 'Unauthorized' }
        }
        return { status: 400, body: 'Bad request' }
      }
    },
  })
}
