import { rest, serve, sdk } from '../src'
import { model, result } from '@mondrian-framework/model'
import { module, functions } from '@mondrian-framework/module'
import { afterAll, describe, expect, test } from 'vitest'

///Types
const User = () =>
  model.entity({
    email: model.string(),
    password: model.string(),
    firstname: model.string().optional(),
    lastname: model.string().optional(),
    friend: model.optional(User),
    metadata: model.object({ a: model.string(), b: model.string() }).setName('Metadata').optional(),
  })
type User = model.Infer<typeof User>
const LoginInput = () =>
  model.object({
    email: model.string(),
    password: model.string(),
  })

//Functions
type SharedContext = {
  db: {
    findUser(filter: { email: string }): User | undefined
    updateUser(user: User): User
  }
}

const login = functions.withContext<SharedContext & { from?: string }>().build({
  input: LoginInput,
  output: model.object({ jwt: model.string(), user: User }).nullable().setName('LoginOuput'),
  errors: { invalidEmailOrPassword: model.string() },
  body: async ({ input, context: { db } }) => {
    const user = db.findUser({ email: input.email })
    if (!user || user.password !== input.password) {
      return result.fail({ invalidEmailOrPassword: 'Invalid email or password' })
    }
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
  errors: { doubleRegister: model.string() },
  body: async ({ input, context: { db } }) => {
    const user = db.findUser({ email: input.email })
    if (user) {
      return result.fail({ doubleRegister: 'Double register' })
    } else {
      return result.ok(db.updateUser(input))
    }
  },
})

const completeProfile = functions.build({
  input: model.object({ firstname: model.string(), lastname: model.string() }),
  output: User,
  body: async () => {
    throw new Error('Unreachable')
  },
})

const getCount = functions.build({
  input: model.number(),
  output: model.number(),
  body: async ({ input }) => {
    return input
  },
})

const findUsers = functions.build({
  input: model.object({
    firstname: model.string(),
    lastname: model.string(),
    info: model.object({ email: model.email() }),
  }),
  output: model.array(User),
  retrieve: { select: true },
  body: async ({ input: { firstname, lastname, info } }) => {
    return [
      {
        email: info.email,
        password: '***',
        firstname,
        lastname,
      },
    ]
  },
})

const findUsers2 = functions.build({
  input: model
    .object({
      firstname: model.string(),
      lastname: model.string(),
      info: model.object({ email: model.email() }),
    })
    .array(),
  output: model.array(User),
  retrieve: { select: true },
  body: async ({ input }) => {
    return input.map((v) => ({
      email: v.info.email,
      password: '***',
      firstname: v.firstname,
      lastname: v.lastname,
    }))
  },
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
  functions: { getCount, login, register, completeProfile, findUsers, findUsers2 },
  context: async ({ ip, authorization }: { ip: string; authorization: string | undefined }) => {
    if (authorization != null) {
      //dummy auth
      const user = db.findUser({ email: authorization })
      if (user) {
        return { from: ip, authenticatedUser: { email: user.email }, db }
      } else {
        throw new Error(`Invalid authorization header`)
      }
    }
    return { from: ip, db }
  },
})

const api = rest.build({
  module: m,
  functions: {
    getCount: { method: 'get', path: '/count/{count}' },
    register: [
      { method: 'put', version: { max: 1 } },
      { method: 'post', path: '/register/{email}', version: { min: 2 } },
    ],
    login: { method: 'post' },
    findUsers: { method: 'get', path: '/findUsers/{firstname}' },
    findUsers2: { method: 'get', path: '/findUsers2' },
  },
  options: { introspection: { path: '/openapi' } },
  version: 2,
})

describe('rest sdk', async () => {
  const server = serve({
    api,
    async context({ server: { request } }) {
      return { authorization: request.headers.authorization, ip: '' }
    },
    maxBodySize: 1024,
  })
  server.listen(50123)
  const client = sdk.build({ api, endpoint: 'http://127.0.0.1:50123', module: m })

  afterAll(() => {
    server.close()
  })
  test('use retrieve', async () => {
    const r1 = await client.functions.findUsers(
      {
        firstname: 'asd',
        lastname: 'lol',
        info: { email: 'test@domain.com' },
      },
      { retrieve: { select: { metadata: { select: { a: true } } } } },
    )
    expect(r1).toEqual([{ email: 'test@domain.com', password: '***', firstname: 'asd', lastname: 'lol' }])
    const r2 = await client.functions.findUsers2([
      {
        firstname: 'asd',
        lastname: 'lol',
        info: { email: 'test@domain.com' },
      },
      {
        firstname: 'lol',
        lastname: 'asd',
        info: { email: 'test2@domain.com' },
      },
    ])
    expect(r2).toEqual([
      { email: 'test@domain.com', password: '***', firstname: 'asd', lastname: 'lol' },
      { email: 'test2@domain.com', password: '***', firstname: 'lol', lastname: 'asd' },
    ])
  })
  test('simple calls', async () => {
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
    const introspectionRes11 = await fetch('http://127.0.0.1:50123/api/v1/register', {
      body: 'not a valid json',
      method: 'put',
    })
    expect(introspectionRes11.status).toBe(400)
    const introspectionRes12 = await fetch('http://127.0.0.1:50123/api/v1/notFound', {
      body: '{}',
      method: 'put',
    })
    expect(introspectionRes12.status).toBe(404)
    const introspectionRes13 = await fetch('http://127.0.0.1:50123/api/v5/count/3', { method: 'get' })
    expect(introspectionRes13.status).toBe(404)

    await expect(async () =>
      client.functions.completeProfile({ firstname: 'asd', lastname: 'asd' }),
    ).rejects.toThrowError('completeProfile is not exposed through rest api.')

    await expect(async () =>
      client.functions.register({ email: 'email@domain.com', password: '1234' }, { headers: { Authorization: '' } }),
    ).rejects.toThrowError('Invalid authorization header')

    const res1 = await client.functions.login({ email: 'email@domain.com', password: '1234' })
    expect(!res1.isOk && res1.error).toEqual({ invalidEmailOrPassword: 'Invalid email or password' })

    const res2 = await client.functions.register({ email: 'email@domain.com', password: '1234' })
    expect(res2.isOk && res2.value).toEqual({ email: 'email@domain.com', password: '1234' })

    const res3 = await client.functions.login({ email: 'email@domain.com', password: '1234' })
    expect(res3.isOk && res3.value).toEqual({
      jwt: 'email@domain.com',
      user: { email: 'email@domain.com', password: '****' },
    })

    const res4 = await client.functions.getCount(2)
    expect(res4).toEqual(2)
  })
})
