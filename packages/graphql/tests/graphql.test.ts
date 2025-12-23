import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Core Integration Tests
// These tests verify the core GraphQL schema generation
// and request handling functionality
// ============================================

// Recursive Entity type with various field types
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

// Function with errors and namespace
const register = functions
  .define({
    input: model.object({ email: model.email() }),
    output: User,
    errors: { emailAlreadyPresent: model.string() },
    retrieve: { select: true },
    options: { namespace: 'user' },
  })
  .implement({
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
  })

// Function with union input type
const pongUser = functions
  .define({
    input: model.union({ user: model.partialDeep(User), error: model.string() }),
    output: model.partialDeep(User),
  })
  .implement({
    body: async ({ input }) => {
      if (typeof input === 'string') {
        throw new Error(input)
      }
      return result.ok(input)
    },
  })

// Complex union type: nullable array of union, all optional
const Metadata = () =>
  model
    .union({
      a: model.object({ a: model.string() }),
      b: model.object({ b: model.string() }),
    })
    .nullable()
    .array()
    .optional()

const pongMetadata = functions
  .define({
    input: Metadata,
    output: Metadata,
  })
  .implement({
    body: async ({ input }) => {
      return result.ok(input)
    },
  })

// Simple function
const addOne = functions
  .define({
    input: model.number(),
    output: model.number(),
  })
  .implement({
    body: async ({ input }) => {
      return result.ok(input + 1)
    },
  })

const testModule = module.build({
  name: 'test',
  options: { maxSelectionDepth: 2 },
  functions: { addOne, register, pongUser, pongMetadata },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: testModule,
    functions: {
      addOne: { type: 'query', name: 'addOne' },
      register: { type: 'mutation' },
      pongUser: { type: 'query', inputName: 'user' },
      pongMetadata: { type: 'query' },
    },
  }),
  context: async (_: ServerContext) => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Core Integration', () => {
  const server = http.createServer(yoga)
  const PORT = 50124

  beforeAll(() => {
    server.listen(PORT)
  })

  afterAll(() => {
    server.close()
  })

  async function makeRequest(query: string): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    })
    return { status: res.status, body: await res.json() }
  }

  describe('Basic Queries', () => {
    test('GET request returns 200', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, { method: 'get' })
      expect(res.status).toBe(200)
    })

    test('simple query with number input/output', async () => {
      const res = await makeRequest('query { addOne(input: 2) }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { addOne: 3 } })
    })
  })

  describe('Mutations with Errors', () => {
    test('mutation returns failure when error condition met', async () => {
      const res = await makeRequest(
        'mutation { user { register(input: { email: "user@domain.com" }) { ... on RegisterFailure { code } } } }',
      )
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { user: { register: { code: 'emailAlreadyPresent' } } } })
    })

    test('mutation returns success with recursive entity', async () => {
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
  })

  describe('Union Input Types', () => {
    test('accepts valid union input with user variant', async () => {
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

    test('rejects empty union input', async () => {
      const res = await makeRequest('query { pongUser(user: {  }) { email, type, tags } }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        errors: [
          {
            message: 'Invalid input.',
            locations: [{ line: 1, column: 9 }],
            path: ['pongUser'],
            extensions: {
              errors: [
                {
                  expected: "object with exactly one of this keys: 'user', 'error'",
                  got: {},
                  path: '$',
                },
              ],
              from: 'input',
            },
          },
        ],
        data: null,
      })
    })

    test('handles error variant that throws', async () => {
      const res = await makeRequest('query { pongUser(user: { error: "error" }) { email, type, tags } }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        errors: [
          {
            message: 'error',
            locations: [{ line: 1, column: 9 }],
            path: ['pongUser'],
          },
        ],
        data: null,
      })
    })
  })

  describe('Complex Union Array Types', () => {
    test('handles undefined optional input', async () => {
      const res = await makeRequest(
        'query { pongMetadata { ... on PongMetadataResultItemA { a }, ... on PongMetadataResultItemB { b } } }',
      )
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: { pongMetadata: null },
      })
    })

    test('handles empty array input', async () => {
      const res = await makeRequest(
        'query { pongMetadata(input: []) { ... on PongMetadataResultItemA { a }, ... on PongMetadataResultItemB { b } } }',
      )
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: { pongMetadata: [] },
      })
    })

    test('handles array with multiple union variants', async () => {
      const res = await makeRequest(
        'query { pongMetadata(input: [{ b: { b: "b" } }, { a: { a: "a" } }]) { ... on PongMetadataResultItemA { a }, ... on PongMetadataResultItemB { b } } }',
      )
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: { pongMetadata: [{ b: 'b' }, { a: 'a' }] },
      })
    })
  })
})
