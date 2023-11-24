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

const pongUser = functions.build({
  input: model.union({ user: model.partialDeep(User), error: model.string() }),
  output: model.partialDeep(User),
  body: async ({ input }) => {
    if (typeof input === 'string') {
      throw new Error(input)
    }
    return input
  },
})
const Metadata = () =>
  model
    .union({
      a: model.object({ a: model.string() }),
      b: model.object({ b: model.string() }),
    })
    .nullable()
    .array()
    .optional()
const pongMetadata = functions.build({
  input: Metadata,
  output: Metadata,
  body: async ({ input }) => {
    return input
  },
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
  functions: { addOne, register, pongUser, pongMetadata },
  context: async () => ({}),
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: m,
    functions: {
      addOne: { type: 'query', name: 'addOne' },
      register: { type: 'mutation' },
      pongUser: { type: 'query', inputName: 'user' },
      pongMetadata: { type: 'query' },
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

  test('success ping', async () => {
    const res = await makeRequest(
      'query { pongUser(user: { user: { email: "user2@domain.com", type: User, tags: [A] } }) { email, type, tags } }',
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: {
        pongUser: {
          email: 'user2@domain.com',
          tags: ['A'],
          type: 'User',
        },
      },
    })
  })

  test('failure ping', async () => {
    const res = await makeRequest('query { pongUser(user: {  }) { email, type, tags } }')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      errors: [
        {
          message: 'Invalid input.',
          locations: [
            {
              line: 1,
              column: 9,
            },
          ],
          path: ['pongUser'],
          extensions: {
            '0': {
              expected: "object with exactly one of this keys: 'user', 'error'",
              got: {},
              path: '$',
            },
          },
        },
      ],
      data: null,
    })
  })

  test('failure ping 2', async () => {
    const res = await makeRequest('query { pongUser(user: { error: "error" }) { email, type, tags } }')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      errors: [
        {
          message: 'error',
          locations: [
            {
              line: 1,
              column: 9,
            },
          ],
          path: ['pongUser'],
        },
      ],
      data: null,
    })
  })

  test('success ping metadata', async () => {
    const res = await makeRequest(
      'query { pongMetadata { ... on PongMetadataResultItemA { a }, ... on PongMetadataResultItemB { b } } }',
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: { pongMetadata: null },
    })

    const res2 = await makeRequest(
      'query { pongMetadata(input: []) { ... on PongMetadataResultItemA { a }, ... on PongMetadataResultItemB { b } } }',
    )
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({
      data: { pongMetadata: [] },
    })

    const res3 = await makeRequest(
      'query { pongMetadata(input: [{ b: { b: "b" } }, { a: { a: "a" } }]) { ... on PongMetadataResultItemA { a }, ... on PongMetadataResultItemB { b } } }',
    )
    expect(res3.status).toBe(200)
    expect(res3.body).toEqual({
      data: { pongMetadata: [{ b: 'b' }, { a: 'a' }] },
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
