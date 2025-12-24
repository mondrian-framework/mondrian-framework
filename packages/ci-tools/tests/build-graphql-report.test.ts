import { module } from '../src/impl/module'
import { client as clientBuilder } from '@mondrian-framework/module'
import { buildSchema } from 'graphql'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('build-graphql-report', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.SERVER_BASE_URL = 'http://localhost:4000'
    delete process.env.BUCKET
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const client = clientBuilder.build({
    module: module,
    async context() {
      return {}
    },
  })

  describe('schema comparisons', () => {
    it('should detect no breaking changes for identical schemas', async () => {
      const schema = buildSchema(`
        type Query {
          hello: String
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema: schema,
        currentSchema: schema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBe(0)
        expect(result.value.reportId).toBeDefined()
        expect(result.value.reportUrl).toContain('/v1/reports/')
      }
    })

    it('should detect breaking change when required argument is added', async () => {
      const previousSchema = buildSchema(`
        type Query {
          login(username: String!): String!
        }
      `)
      const currentSchema = buildSchema(`
        type Query {
          login(username: String!, password: String!): String!
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema,
        currentSchema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBeGreaterThan(0)
      }
    })

    it('should detect breaking change when optional argument becomes required', async () => {
      const previousSchema = buildSchema(`
        type Query {
          login(username: String!, password: String): String!
        }
      `)
      const currentSchema = buildSchema(`
        type Query {
          login(username: String!, password: String!): String!
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema,
        currentSchema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBe(1)
      }
    })

    it('should detect breaking change when field is removed', async () => {
      const previousSchema = buildSchema(`
        type Query {
          hello: String
          goodbye: String
        }
      `)
      const currentSchema = buildSchema(`
        type Query {
          hello: String
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema,
        currentSchema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBeGreaterThan(0)
      }
    })

    it('should detect breaking change when type changes', async () => {
      const previousSchema = buildSchema(`
        type Query {
          count: Int
        }
      `)
      const currentSchema = buildSchema(`
        type Query {
          count: String
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema,
        currentSchema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBeGreaterThan(0)
      }
    })

    it('should not count non-breaking changes as breaking', async () => {
      const previousSchema = buildSchema(`
        type Query {
          hello: String
        }
      `)
      const currentSchema = buildSchema(`
        type Query {
          hello: String
          newField: String
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema,
        currentSchema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBe(0)
      }
    })

    it('should handle complex schema with mutations', async () => {
      const previousSchema = buildSchema(`
        type Query {
          users: [User!]!
        }
        type Mutation {
          createUser(name: String!): User!
        }
        type User {
          id: ID!
          name: String!
        }
      `)
      const currentSchema = buildSchema(`
        type Query {
          users: [User!]!
        }
        type Mutation {
          createUser(name: String!, email: String!): User!
        }
        type User {
          id: ID!
          name: String!
          email: String
        }
      `)

      const result = await client.functions.buildGraphQLReport({
        previousSchema,
        currentSchema,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.breakingChanges).toBeGreaterThan(0)
      }
    })
  })

  describe('report URL and storage', () => {
    it('should include report URL when SERVER_BASE_URL is set', async () => {
      process.env.SERVER_BASE_URL = 'https://api.example.com'

      const result = await client.functions.buildGraphQLReport({
        previousSchema: buildSchema(`type Query { test: String }`),
        currentSchema: buildSchema(`type Query { test: String }`),
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.reportUrl).toBe(`https://api.example.com/v1/reports/${result.value.reportId}`)
      }
    })

    it('should not include report URL when SERVER_BASE_URL is not set', async () => {
      delete process.env.SERVER_BASE_URL

      const result = await client.functions.buildGraphQLReport({
        previousSchema: buildSchema(`type Query { test: String }`),
        currentSchema: buildSchema(`type Query { test: String }`),
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.reportUrl).toBeUndefined()
      }
    })
  })

  describe('password handling', () => {
    it('should accept custom password', async () => {
      const result = await client.functions.buildGraphQLReport({
        previousSchema: buildSchema(`type Query { test: String }`),
        currentSchema: buildSchema(`type Query { test: String }`),
        password: 'mySecretPassword',
      })

      expect(result.isOk).toBe(true)
    })

    it('should work without password (uses default)', async () => {
      const result = await client.functions.buildGraphQLReport({
        previousSchema: buildSchema(`type Query { test: String }`),
        currentSchema: buildSchema(`type Query { test: String }`),
      })

      expect(result.isOk).toBe(true)
    })
  })

  describe('remote schema handling', () => {
    it('should fail gracefully when remote URL is unreachable', async () => {
      const result = await client.functions.buildGraphQLReport({
        previousSchema: { url: 'http://localhost:9999/graphql' },
        currentSchema: buildSchema(`type Query { test: String }`),
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.badRequest).toContain('Cannot download schema')
      }
    })

    it('should fail when remote returns non-200 status', async () => {
      // Mock a server that returns 404
      const result = await client.functions.buildGraphQLReport({
        previousSchema: { url: 'http://httpstat.us/404' },
        currentSchema: buildSchema(`type Query { test: String }`),
      })

      expect(result.isFailure).toBe(true)
    })
  })
})
