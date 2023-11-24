import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, describe, expect, test } from 'vitest'

const User = () =>
  model.entity({
    email: model.email(),
    friendCount: model.integer(),
    friends: model.array(User).mutable(),
    type: model.literal('User'),
    active: model.boolean(),
    tags: model.enumeration(['A', 'B'], { name: 'UserTags' }).array().nullable(),
    audit: model.object({
      registeredAt: model.datetime(),
      loggedInAt: model.datetime().optional(),
    }),
  })
type User = model.Infer<typeof User>

const register = functions.build({
  input: model.object({ email: model.email() }),
  output: User,
  errors: { emailAlreadyPresent: model.string() },
  retrieve: { select: true },
  body: async ({ input: { email } }) => {
    if (email === 'user@domain.com') {
      return result.fail({ emailAlreadyPresent: email })
    }
    const user: User = {
      email,
      active: true,
      audit: { registeredAt: new Date() },
      friendCount: 1,
      friends: [],
      tags: ['A'],
      type: 'User',
    }
    user.friends.push(user)
    return result.ok(user)
  },
  options: { namespace: 'user' },
})

const addOne = functions.build({
  input: model.number(),
  output: model.number(),
  body: async ({ input }) => {
    return input + 1
  },
})

const m = module.build({
  name: 'test',
  version: '1.0.0',
  options: { maxSelectionDepth: 2 },
  functions: { addOne, register },
  context: async () => ({}),
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: m,
    functions: {
      addOne: { type: 'query', name: 'addOne' },
      register: { type: 'mutation' },
    },
  }),
  context: async (_: ServerContext) => ({}),
  setHeader: (ctx, name, value) => ctx.res.setHeader(name, value),
})

const yoga = createYoga<ServerContext>({ schema })

describe('graphql', () => {
  const server = http.createServer(yoga)
  server.listen(50124)

  test('simple queries', async () => {
    const res = await fetch('http://127.0.0.1:50124/graphql', { method: 'get' })
    expect(res.status).toBe(200)
    const res2 = await makeRequest('query { addOne(input: 2) }')
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({ data: { addOne: 3 } })
  })

  test('failing mutation', async () => {
    const res = await makeRequest(
      'mutation { user { register(input: { email: "user@domain.com" }) { ... on RegisterFailure { errorCode } } } }',
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { user: { register: { errorCode: 'emailAlreadyPresent' } } } })
  })

  test('success mutation', async () => {
    const res = await makeRequest(
      'mutation { user { register(input: { email: "user2@domain.com" }) { ... on User { email, friends { email } } } } }',
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: {
        user: {
          register: {
            email: 'user2@domain.com',
            friends: [{ email: 'user2@domain.com' }],
          },
        },
      },
    })
  })

  afterAll(() => {
    server.close()
  })
})

async function makeRequest(query: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch('http://127.0.0.1:50124/graphql', {
    method: 'post',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  })
  return { status: res.status, body: await res.json() }
}
