import { model, result } from '@mondrian-framework/model'
import { module, functions } from '@mondrian-framework/module'
import { rest, serve, sdk } from '../src'
import { expect, test } from 'vitest'

///Types
const User = () =>
  model.entity({
    email: model.string(),
    password: model.string(),
    firstname: model.string().optional(),
    lastname: model.string().optional(),
    friend: model.optional(User),
    metadata: model
      .record(model.string({ maxLength: 1024 }))
      .setName('Metadata')
      .optional(),
  })
type User = model.Infer<typeof User>
const LoginInput = () =>
  model.object(
    {
      email: model.string(),
      password: model.string(),
    },
    { name: 'LoginInput' },
  )
const LoginOutput = model.object({ jwt: model.string(), user: User }).nullable().setName('LoginOuput')

//Functions
type SharedContext = {
  db: {
    findUser(filter: { email: string }): User | undefined
    updateUser(user: User): User
  }
}

const login = functions.withContext<SharedContext & { from?: string }>().build({
  input: LoginInput,
  output: LoginOutput,
  errors: { invalidEmailOrPassword: model.literal('Invalid email or password') },
  retrieve: undefined,
  body: async ({ input, context: { db }, logger }) => {
    const user = db.findUser({ email: input.email })
    if (!user || user.password !== input.password) {
      logger.logWarn(`Invalid email or password: ${input.email}`)
      return result.fail({ invalidEmailOrPassword: 'Invalid email or password' })
    }
    logger.logInfo(`Logged in: ${input.email}`)
    return result.ok({ jwt: user.email, user })
  },
  middlewares: [
    {
      name: 'Hide password',
      apply: async (args, next) => {
        const res = await next(args)
        if (res.isOk && res.value?.user?.password) {
          return result.ok({ ...res.value, user: { ...res.value.user, password: '****' } })
        }
        return res
      },
    },
  ],
  options: { namespace: 'authentication' },
})

const register = functions.withContext<SharedContext & { from?: string }>().build({
  input: LoginInput,
  output: User,
  errors: { doubleRegister: model.literal('Double register') },
  body: async ({ input, context: { db } }) => {
    const user = db.findUser({ email: input.email })
    if (user) {
      return result.fail({ doubleRegister: 'Double register' })
    } else {
      return result.ok(db.updateUser(input))
    }
  },
})

const completeProfile = functions.withContext<SharedContext & { authenticatedUser?: { email: string } }>().build({
  input: model.object({ firstname: model.string(), lastname: model.string() }),
  output: User,
  errors: { unauthorized: model.literal('unauthorized') },
  retrieve: undefined,
  body: async ({ input, context: { db, authenticatedUser } }) => {
    if (!authenticatedUser) {
      return result.fail({ unauthorized: 'unauthorized' })
    }
    const user = db.findUser({ email: authenticatedUser.email })
    if (!user) {
      throw new Error('Unrechable')
    }
    return result.ok(db.updateUser({ ...user, ...input }))
  },
  options: { namespace: 'business-logic' },
})
const memory = new Map<string, User>()
const db: SharedContext['db'] = {
  updateUser(user) {
    memory.set(user.email, user)
    return user
  },
  findUser(user) {
    return memory.get(user.email)
  },
}

const m = module.build({
  name: 'test',
  version: '1.0.0',
  options: { maxSelectionDepth: 2 },
  functions: { login, register, completeProfile },
  context: async ({ ip, authorization }: { ip: string; authorization: string | undefined }) => {
    if (authorization != null) {
      //dummy auth
      const user = db.findUser({ email: authorization })
      if (user) {
        return { from: ip, authenticatedUser: { email: user.email }, db }
      } else {
        throw `Invalid authorization`
      }
    }
    return { from: ip, db }
  },
})

const api = rest.build({
  module: m,
  functions: {
    register: [
      { method: 'put', version: { max: 1 } },
      { method: 'post', path: '/register/{email}', version: { min: 2 } },
    ],
    login: { method: 'post' },
  },
  options: { introspection: true },
  version: 2,
})

test('test sdk', async () => {
  const server = serve({
    api,
    async context({ server: { request } }) {
      return { authorization: request.headers.authorization, ip: '' }
    },
    maxBodySize: 1024,
  })
  server.listen(50123)

  const introspectionRes1 = await fetch('http://127.0.0.1:50123/openapi')
  expect(introspectionRes1.status).toBe(308)
  const introspectionRes2 = await fetch('http://127.0.0.1:50123/openapi/index.html')
  expect(introspectionRes2.status).toBe(200)
  const introspectionRes3 = await fetch('http://127.0.0.1:50123/openapi/swagger-initializer.js')
  expect(introspectionRes3.status).toBe(200)
  const introspectionRes4 = await fetch('http://127.0.0.1:50123/openapi/v1/schema.json')
  expect(introspectionRes4.status).toBe(200)
  const introspectionRes5 = await fetch('http://127.0.0.1:50123/openapi/v2/schema.json')
  expect(introspectionRes5.status).toBe(200)
  const introspectionRes6 = await fetch('http://127.0.0.1:50123/openapi/1/schema.json')
  expect(introspectionRes6.status).toBe(200)
  const introspectionRes7 = await fetch('http://127.0.0.1:50123/openapi/..')
  expect(introspectionRes7.status).toBe(404)
  const introspectionRes8 = await fetch('http://127.0.0.1:50123/openapi/v3/schema.json')
  expect(introspectionRes8.status).toBe(404)
  const introspectionRes9 = await fetch('http://127.0.0.1:50123/openapi/v2/schema')
  expect(introspectionRes9.status).toBe(404)
  const introspectionRes10 = await fetch('http://127.0.0.1:50123/openapi/v2/schema', {
    body: Buffer.alloc(1025),
    method: 'post',
  })
  expect(introspectionRes10.status).toBe(413)

  const client = sdk.build({ api, endpoint: 'http://127.0.0.1:50123', module: m })

  await expect(async () =>
    client.functions.completeProfile({ firstname: 'asd', lastname: 'asd' }),
  ).rejects.toThrowError('completeProfile is not exposed through rest api.')

  const res1 = await client.functions.login({ email: 'email@domain.com', password: '1234' })
  expect(!res1.isOk && res1.error).toEqual({ invalidEmailOrPassword: 'Invalid email or password' })

  const res2 = await client.functions.register({ email: 'email@domain.com', password: '1234' })
  expect(res2.isOk && res2.value).toEqual({ email: 'email@domain.com', password: '1234' })

  const res3 = await client.functions.login({ email: 'email@domain.com', password: '1234' })
  expect(res3.isOk && res3.value).toEqual({
    jwt: 'email@domain.com',
    user: { email: 'email@domain.com', password: '****' },
  })

  server.close()
})
