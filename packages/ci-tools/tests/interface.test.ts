import {
  OASSchema,
  GraphQLSchemaType,
  ReportResult,
  ReporId,
  Password,
  HTMLReponse,
  RemoteSchema,
  moduleInterface,
  restAPI,
} from '../src/interface'
import { decoding, model } from '@mondrian-framework/model'
import { buildSchema, GraphQLSchema, printSchema } from 'graphql'
import { describe, expect, it } from 'vitest'

describe('interface', () => {
  describe('OASSchema', () => {
    it('should validate valid OpenAPI 3.0 schema', () => {
      const validOAS = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      }

      const result = model.concretise(OASSchema).decode(validOAS, { fieldStrictness: 'allowAdditionalFields' })
      expect(result.isOk).toBe(true)
    })

    it('should validate schema with all optional fields', () => {
      const fullOAS = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
        servers: [{ url: 'https://api.example.com' }],
        paths: { '/users': {} },
        webhooks: {},
        components: {},
        security: [],
        tags: [],
        externalDocs: { url: 'https://docs.example.com' },
      }

      const result = model.concretise(OASSchema).decode(fullOAS, { fieldStrictness: 'allowAdditionalFields' })
      expect(result.isOk).toBe(true)
    })

    it('should fail for invalid schema without openapi field', () => {
      const invalidOAS = {
        info: { title: 'Test', version: '1.0.0' },
      }

      const result = model.concretise(OASSchema).decode(invalidOAS as any, { fieldStrictness: 'allowAdditionalFields' })
      expect(result.isOk).toBe(false)
    })
  })

  describe('GraphQLSchemaType', () => {
    it('should accept GraphQLSchema instance', () => {
      const schema = buildSchema(`type Query { hello: String }`)
      const graphqlType = model.concretise(GraphQLSchemaType)

      const result = graphqlType.decode(schema)
      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value).toBeInstanceOf(GraphQLSchema)
      }
    })

    it('should parse valid GraphQL schema string', () => {
      const schemaString = `type Query { hello: String }`
      const graphqlType = model.concretise(GraphQLSchemaType)

      const result = graphqlType.decode(schemaString)
      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value).toBeInstanceOf(GraphQLSchema)
      }
    })

    it('should fail for invalid GraphQL schema string', () => {
      const invalidSchema = 'not a valid graphql schema { {{ }'
      const graphqlType = model.concretise(GraphQLSchemaType)

      const result = graphqlType.decode(invalidSchema)
      expect(result.isOk).toBe(false)
    })

    it('should fail for non-string non-GraphQLSchema values', () => {
      const graphqlType = model.concretise(GraphQLSchemaType)

      const result = graphqlType.decode(123)
      expect(result.isOk).toBe(false)
    })

    it('should fail for null values', () => {
      const graphqlType = model.concretise(GraphQLSchemaType)

      const result = graphqlType.decode(null)
      expect(result.isOk).toBe(false)
    })

    it('should encode GraphQLSchema back to string', () => {
      const schema = buildSchema(`type Query { hello: String }`)
      const graphqlType = model.concretise(GraphQLSchemaType)

      const encoded = graphqlType.encodeWithoutValidation(schema as GraphQLSchema)
      expect(typeof encoded).toBe('string')
      expect(encoded).toContain('Query')
    })
  })

  describe('ReportResult', () => {
    it('should validate valid report result', () => {
      const validResult = {
        breakingChanges: 5,
        reportId: '550e8400-e29b-41d4-a716-446655440000',
        reportUrl: 'https://example.com/reports/123',
        info: { some: 'data' },
      }

      const result = model.concretise(ReportResult).decode(validResult)
      expect(result.isOk).toBe(true)
    })

    it('should validate result without optional reportUrl', () => {
      const validResult = {
        breakingChanges: 0,
        reportId: '550e8400-e29b-41d4-a716-446655440000',
        info: null,
      }

      const result = model.concretise(ReportResult).decode(validResult)
      expect(result.isOk).toBe(true)
    })

    it('should fail for invalid report result', () => {
      const invalidResult = {
        breakingChanges: 'not a number',
        reportId: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = model.concretise(ReportResult).decode(invalidResult as any)
      expect(result.isOk).toBe(false)
    })
  })

  describe('ReporId', () => {
    it('should accept valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const result = model.concretise(ReporId).decode(uuid)
      expect(result.isOk).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const invalidUuid = 'not-a-uuid'
      const result = model.concretise(ReporId).decode(invalidUuid)
      expect(result.isOk).toBe(false)
    })
  })

  describe('Password', () => {
    it('should accept valid password', () => {
      const password = 'mySecretPassword'
      const result = model.concretise(Password).decode(password)
      expect(result.isOk).toBe(true)
    })

    it('should reject empty password', () => {
      const result = model.concretise(Password).decode('')
      expect(result.isOk).toBe(false)
    })

    it('should reject password longer than 100 characters', () => {
      const longPassword = 'a'.repeat(101)
      const result = model.concretise(Password).decode(longPassword)
      expect(result.isOk).toBe(false)
    })

    it('should accept password with exactly 100 characters', () => {
      const maxPassword = 'a'.repeat(100)
      const result = model.concretise(Password).decode(maxPassword)
      expect(result.isOk).toBe(true)
    })
  })

  describe('HTMLReponse', () => {
    it('should accept any string', () => {
      const html = '<!DOCTYPE html><html><body>Hello</body></html>'
      const result = model.concretise(HTMLReponse).decode(html)
      expect(result.isOk).toBe(true)
    })
  })

  describe('RemoteSchema', () => {
    it('should accept valid URL with headers', () => {
      const remoteSchema = {
        url: 'https://api.example.com/graphql',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      }

      const result = model.concretise(RemoteSchema).decode(remoteSchema)
      expect(result.isOk).toBe(true)
    })

    it('should accept URL without headers', () => {
      const remoteSchema = {
        url: 'https://api.example.com/graphql',
      }

      const result = model.concretise(RemoteSchema).decode(remoteSchema)
      expect(result.isOk).toBe(true)
    })

    it('should reject invalid URL', () => {
      const remoteSchema = {
        url: 'not-a-url',
      }

      const result = model.concretise(RemoteSchema).decode(remoteSchema)
      expect(result.isOk).toBe(false)
    })
  })

  describe('moduleInterface', () => {
    it('should have the correct name', () => {
      expect(moduleInterface.name).toBe('Mondrian CI-Tools')
    })

    it('should have all required functions', () => {
      expect(moduleInterface.functions.getReport).toBeDefined()
      expect(moduleInterface.functions.buildOASReport).toBeDefined()
      expect(moduleInterface.functions.buildGraphQLReport).toBeDefined()
    })
  })

  describe('restAPI', () => {
    it('should have version 1', () => {
      expect(restAPI.version).toBe(1)
    })

    it('should define correct HTTP methods and paths', () => {
      expect((restAPI.functions.getReport as any).method).toBe('get')
      expect((restAPI.functions.getReport as any).path).toBe('/reports/{reportId}')

      expect((restAPI.functions.buildOASReport as any).method).toBe('post')
      expect((restAPI.functions.buildOASReport as any).path).toBe('/reports/oas')
      expect((restAPI.functions.buildGraphQLReport as any).method).toBe('post')
      expect((restAPI.functions.buildGraphQLReport as any).path).toBe('/reports/graphql')
    })
  })
})
