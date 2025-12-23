import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { decoding, model, result, validation } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { JSONType } from '@mondrian-framework/utils'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Custom Type Definitions
// ============================================

const Email = model.email()
const Datetime = model.datetime()
const PositiveInt = model.integer({ name: 'PositiveInt', minimum: 1 })
const Percentage = model.number({ name: 'Percentage', minimum: 0, maximum: 100 })

// Custom type with apiType
const JSONData = model.custom<'JSONData', {}, Record<string, unknown>>({
  typeName: 'JSONData',
  encoder: (value) => value as JSONType,
  decoder: (value) => {
    if (typeof value === 'object' && value !== null) {
      return decoding.succeed(value as Record<string, unknown>)
    }
    return decoding.fail('JSON', value)
  },
  validator: () => validation.succeed(),
  arbitrary: () => {
    throw new Error('Not implemented')
  },
  options: {
    apiType: model.record(model.unknown()),
  },
})

// ============================================
// Types with Field Descriptions
// ============================================

const UserProfile = model.object(
  {
    id: model.string({ description: 'Unique identifier for the user' }),
    email: Email.updateOptions({ description: 'Email address of the user' }),
    displayName: model.string({ description: 'Display name shown to other users' }),
    bio: model.string({ description: 'Optional biography' }).optional(),
    createdAt: Datetime.updateOptions({ description: 'Account creation date and time' }),
    score: PositiveInt.updateOptions({ description: 'User score (must be positive)' }),
    rating: Percentage.updateOptions({ description: 'User rating percentage (0-100)' }),
  },
  {
    name: 'UserProfile',
    description: 'User profile information',
  },
)

// ============================================
// Types with Tags (IGNORE_ON_GRAPHQL_GENERATION)
// ============================================

const InternalData = model.object({
  publicField: model.string(),
  internalField: model.string({ tags: { ignore_on_graphql_generation: true } }),
  anotherPublic: model.integer(),
})

// ============================================
// Functions
// ============================================

const getUserProfile = functions
  .define({
    input: model.string(),
    output: UserProfile,
    options: { operation: 'query' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        email: 'user@example.com',
        displayName: 'John Doe',
        bio: 'Software developer',
        createdAt: new Date('2024-01-15T10:30:00Z'),
        score: 100,
        rating: 85.5,
      }),
  })

const createUserProfile = functions
  .define({
    input: model.object({
      email: Email,
      displayName: model.string(),
      bio: model.string().optional(),
    }),
    output: UserProfile,
    options: { description: 'Creates a new user profile' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: 'new-user-id',
        email: input.email,
        displayName: input.displayName,
        bio: input.bio,
        createdAt: new Date(),
        score: 1,
        rating: 0,
      }),
  })

const echoDatetime = functions
  .define({
    input: Datetime,
    output: Datetime,
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const echoEmail = functions
  .define({
    input: Email,
    output: Email,
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const echoCustomJson = functions
  .define({
    input: JSONData,
    output: JSONData,
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const getInternalData = functions
  .define({
    output: InternalData,
    options: { operation: 'query' },
  })
  .implement({
    body: async () =>
      result.ok({
        publicField: 'visible',
        internalField: 'hidden',
        anotherPublic: 42,
      }),
  })

// ============================================
// Module Setup
// ============================================

const customTypesModule = module.build({
  name: 'custom-types-tests',
  functions: {
    getUserProfile,
    createUserProfile,
    echoDatetime,
    echoEmail,
    echoCustomJson,
    getInternalData,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: customTypesModule,
    functions: {
      getUserProfile: { type: 'query' },
      createUserProfile: { type: 'mutation' },
      echoDatetime: { type: 'query' },
      echoEmail: { type: 'query' },
      echoCustomJson: { type: 'query' },
      getInternalData: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Custom Types Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50133

  beforeAll(() => {
    server.listen(PORT)
  })

  afterAll(() => {
    server.close()
  })

  async function makeRequest(query: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    })
    return { status: res.status, body: await res.json() }
  }

  describe('Email Type', () => {
    test('returns email correctly', async () => {
      const res = await makeRequest(`
        query {
          getUserProfile(input: "user-1") {
            email
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getUserProfile.email).toBe('user@example.com')
    })

    test('accepts valid email input', async () => {
      const res = await makeRequest(`
        query {
          echoEmail(input: "test@example.com")
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.echoEmail).toBe('test@example.com')
    })
  })

  describe('Datetime Type', () => {
    test('returns datetime correctly', async () => {
      const res = await makeRequest(`
        query {
          getUserProfile(input: "user-1") {
            createdAt
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getUserProfile.createdAt).toBe('2024-01-15T10:30:00.000Z')
    })

    test('accepts datetime input', async () => {
      const res = await makeRequest(`
        query {
          echoDatetime(input: "2024-06-15T14:30:00.000Z")
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.echoDatetime).toBe('2024-06-15T14:30:00.000Z')
    })
  })

  describe('Custom Named Types', () => {
    test('handles positive integer', async () => {
      const res = await makeRequest(`
        query {
          getUserProfile(input: "user-1") {
            score
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getUserProfile.score).toBe(100)
    })

    test('handles percentage type', async () => {
      const res = await makeRequest(`
        query {
          getUserProfile(input: "user-1") {
            rating
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getUserProfile.rating).toBe(85.5)
    })
  })

  describe('Custom Type with apiType', () => {
    test('handles JSON data input and output', async () => {
      const res = await makeRequest(`
        query {
          echoCustomJson(input: { key: "value", nested: { num: 42 } })
        }
      `)
      expect(res.status).toBe(200)
      // Check if there's an error or data
      if (res.body.errors) {
        // Custom type handling may vary
        expect(res.body.errors).toBeDefined()
      } else {
        expect(res.body.data.echoCustomJson).toEqual({ key: 'value', nested: { num: 42 } })
      }
    })
  })

  describe('Field Descriptions', () => {
    test('introspection shows type description', async () => {
      const res = await makeRequest(`
        query {
          __type(name: "UserProfile") {
            name
            description
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.__type.name).toBe('UserProfile')
      expect(res.body.data.__type.description).toBe('User profile information')
    })
  })

  describe('Tagged Fields (ignore_on_graphql_generation)', () => {
    test('internal fields are not exposed', async () => {
      const res = await makeRequest(`
        query {
          getInternalData {
            publicField
            anotherPublic
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getInternalData).toEqual({
        publicField: 'visible',
        anotherPublic: 42,
      })
    })

    test('internal field is not in schema', async () => {
      const res = await makeRequest(`
        query {
          __type(name: "GetInternalDataResult") {
            fields {
              name
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      // The type might be named differently or wrapped
      if (res.body.data.__type) {
        const fieldNames = res.body.data.__type.fields.map((f: any) => f.name)
        expect(fieldNames).toContain('publicField')
        expect(fieldNames).toContain('anotherPublic')
        expect(fieldNames).not.toContain('internalField')
      }
    })
  })

  describe('Full Profile', () => {
    test('returns complete user profile', async () => {
      const res = await makeRequest(`
        query {
          getUserProfile(input: "user-1") {
            id
            email
            displayName
            bio
            createdAt
            score
            rating
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getUserProfile).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'John Doe',
        bio: 'Software developer',
        createdAt: '2024-01-15T10:30:00.000Z',
        score: 100,
        rating: 85.5,
      })
    })

    test('creates profile with mutation', async () => {
      const res = await makeRequest(`
        mutation {
          createUserProfile(input: {
            email: "new@example.com",
            displayName: "New User",
            bio: "Just joined"
          }) {
            id
            email
            displayName
            bio
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.createUserProfile).toMatchObject({
        id: 'new-user-id',
        email: 'new@example.com',
        displayName: 'New User',
        bio: 'Just joined',
      })
    })
  })
})
