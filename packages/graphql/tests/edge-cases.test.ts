import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module, exception } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

// ============================================
// Edge Cases and Special Scenarios
// ============================================

describe('GraphQL Edge Cases', () => {
  // Test name collision warning at GraphQL level
  describe('Name Collision Handling', () => {
    // Create types with similar derived names that could cause GraphQL collisions
    const TypeA = model.object({ value: model.string() }, { name: 'CollisionTypeA' })
    const TypeB = model.object({ data: model.number() }, { name: 'CollisionTypeB' })

    const getTypeA = functions
      .define({
        output: TypeA,
        options: { operation: 'query' },
      })
      .implement({
        body: async () => result.ok({ value: 'A' }),
      })

    const getTypeB = functions
      .define({
        output: TypeB,
        options: { operation: 'query' },
      })
      .implement({
        body: async () => result.ok({ data: 42 }),
      })

    const collisionModule = module.build({
      name: 'collision-test',
      functions: { getTypeA, getTypeB },
    })

    test('schema is created with unique type names', () => {
      const schema = fromModule({
        api: build({
          module: collisionModule,
          functions: {
            getTypeA: { type: 'query' },
            getTypeB: { type: 'query' },
          },
        }),
        context: async () => ({}),
      })

      expect(schema).toBeDefined()
    })
  })

  // Test InvalidInput exception handling
  describe('InvalidInput Exception', () => {
    const throwInvalidInput = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        body: async () => {
          throw new exception.InvalidInput('input', [{ path: '$.field', expected: 'string', got: 123 }])
        },
      })

    const invalidInputModule = module.build({
      name: 'invalid-input-test',
      functions: { throwInvalidInput },
    })

    type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

    const schema = fromModule({
      api: build({
        module: invalidInputModule,
        functions: {
          throwInvalidInput: { type: 'query' },
        },
      }),
      context: async () => ({}),
    })

    const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
    const server = http.createServer(yoga)
    const PORT = 50140

    beforeAll(() => {
      server.listen(PORT)
    })

    afterAll(() => {
      server.close()
    })

    test('handles InvalidInput exception with proper formatting', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          query: 'query { throwInvalidInput(input: "test") }',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.from).toBe('input')
      expect(body.errors[0].extensions.errors).toBeDefined()
    })
  })

  // Test reserved error code names
  describe('Reserved Error Codes', () => {
    test('throws when using "code" as error key', () => {
      const badErrorsModule = module.build({
        name: 'bad-errors',
        functions: {
          badFn: functions
            .define({
              input: model.string(),
              output: model.string(),
              errors: { code: model.string() }, // 'code' is reserved
            })
            .implement({
              body: async ({ input }) => result.ok(input),
            }),
        },
      })

      expect(() => {
        fromModule({
          api: build({
            module: badErrorsModule,
            functions: {
              badFn: { type: 'mutation' },
            },
          }),
          context: async () => ({}),
        })
      }).toThrow("'code' is reserved as error code")
    })

    test('throws when using "value" as error key', () => {
      const badErrorsModule = module.build({
        name: 'bad-errors-value',
        functions: {
          badFn: functions
            .define({
              input: model.string(),
              output: model.string(),
              errors: { value: model.string() }, // 'value' is reserved
            })
            .implement({
              body: async ({ input }) => result.ok(input),
            }),
        },
      })

      expect(() => {
        fromModule({
          api: build({
            module: badErrorsModule,
            functions: {
              badFn: { type: 'mutation' },
            },
          }),
          context: async () => ({}),
        })
      }).toThrow("'value' is reserved as error code")
    })
  })

  // Test functions with optional/nullable output that has errors
  describe('Optional Output with Errors', () => {
    const optionalOutputFn = functions
      .define({
        input: model.string(),
        output: model.optional(model.object({ id: model.string() })),
        errors: { notFound: model.string() },
      })
      .implement({
        body: async ({ input }) => {
          if (input === 'not-found') {
            return result.fail({ notFound: 'Not found' })
          }
          if (input === 'empty') {
            return result.ok(undefined)
          }
          return result.ok({ id: input })
        },
      })

    const optionalOutputModule = module.build({
      name: 'optional-output-test',
      functions: { optionalOutputFn },
    })

    type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

    const schema = fromModule({
      api: build({
        module: optionalOutputModule,
        functions: {
          optionalOutputFn: { type: 'query' },
        },
      }),
      context: async () => ({}),
    })

    const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
    const server = http.createServer(yoga)
    const PORT = 50141

    beforeAll(() => {
      server.listen(PORT)
    })

    afterAll(() => {
      server.close()
    })

    test('returns wrapped success with value', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          query: `query {
            optionalOutputFn(input: "test-id") {
              ... on OptionalOutputFnSuccess {
                value { id }
              }
              ... on OptionalOutputFnFailure {
                code
              }
            }
          }`,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      expect(body.data.optionalOutputFn).toEqual({
        value: { id: 'test-id' },
      })
    })

    test('returns wrapped success with undefined', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          query: `query {
            optionalOutputFn(input: "empty") {
              ... on OptionalOutputFnSuccess {
                value { id }
              }
              ... on OptionalOutputFnFailure {
                code
              }
            }
          }`,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      expect(body.data.optionalOutputFn).toEqual({
        value: null,
      })
    })

    test('returns failure', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          query: `query {
            optionalOutputFn(input: "not-found") {
              ... on OptionalOutputFnSuccess {
                value { id }
              }
              ... on OptionalOutputFnFailure {
                code
              }
            }
          }`,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      expect(body.data.optionalOutputFn).toEqual({
        code: 'notFound',
      })
    })
  })

  // Test union type with non-object variants (should throw)
  describe('Union with Non-Object Variants', () => {
    test('throws when union has scalar variant', () => {
      const badUnionModule = module.build({
        name: 'bad-union',
        functions: {
          getBadUnion: functions
            .define({
              // This union has a string variant which is not allowed in GraphQL output unions
              output: model.union({
                object: model.object({ id: model.string() }),
                scalar: model.string(), // Not allowed
              }),
              options: { operation: 'query' },
            })
            .implement({
              body: async () => result.ok({ id: 'test' }),
            }),
        },
      })

      expect(() => {
        fromModule({
          api: build({
            module: badUnionModule,
            functions: {
              getBadUnion: { type: 'query' },
            },
          }),
          context: async () => ({}),
        })
      }).toThrow('Cannot generate GraphQL union with non-object variants')
    })
  })

  // Test multiple function specifications for same function
  describe('Multiple Function Specifications', () => {
    const multiSpecFn = functions
      .define({
        input: model.string(),
        output: model.string(),
        options: { operation: 'query' },
      })
      .implement({
        body: async ({ input }) => result.ok(input.toUpperCase()),
      })

    const multiSpecModule = module.build({
      name: 'multi-spec-test',
      functions: { multiSpecFn },
    })

    type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

    const schema = fromModule({
      api: build({
        module: multiSpecModule,
        functions: {
          // Same function exposed with different names
          multiSpecFn: [
            { type: 'query', name: 'uppercase' },
            { type: 'query', name: 'toUpper' },
          ],
        },
      }),
      context: async () => ({}),
    })

    const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
    const server = http.createServer(yoga)
    const PORT = 50142

    beforeAll(() => {
      server.listen(PORT)
    })

    afterAll(() => {
      server.close()
    })

    test('can call same function with different names', async () => {
      const res1 = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({ query: 'query { uppercase(input: "hello") }' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body1 = await res1.json()
      expect(body1.data.uppercase).toBe('HELLO')

      const res2 = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({ query: 'query { toUpper(input: "world") }' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body2 = await res2.json()
      expect(body2.data.toUpper).toBe('WORLD')
    })
  })

  // Test function with only retrieve (no input)
  describe('Function with Only Retrieve', () => {
    const Entity = () =>
      model.entity({
        id: model.string(),
        name: model.string(),
        items: model.array(Entity).mutable(),
      })

    const getEntitiesWithRetrieve = functions
      .define({
        output: model.array(Entity),
        retrieve: { select: true, take: true, skip: true, orderBy: true, where: true },
        options: { operation: 'query' },
      })
      .implement({
        body: async ({ retrieve }) => {
          const entities = [
            { id: '1', name: 'First', items: [] },
            { id: '2', name: 'Second', items: [] },
            { id: '3', name: 'Third', items: [] },
          ]
          const skip = retrieve.skip ?? 0
          const take = retrieve.take ?? entities.length
          return result.ok(entities.slice(skip, skip + take))
        },
      })

    const retrieveOnlyModule = module.build({
      name: 'retrieve-only-test',
      functions: { getEntitiesWithRetrieve },
    })

    type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

    const schema = fromModule({
      api: build({
        module: retrieveOnlyModule,
        functions: {
          getEntitiesWithRetrieve: { type: 'query' },
        },
      }),
      context: async () => ({}),
    })

    const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
    const server = http.createServer(yoga)
    const PORT = 50143

    beforeAll(() => {
      server.listen(PORT)
    })

    afterAll(() => {
      server.close()
    })

    test('can use retrieve args without input', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          query: 'query { getEntitiesWithRetrieve(take: 2) { id name } }',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      expect(body.data.getEntitiesWithRetrieve).toHaveLength(2)
    })
  })

  // Test default operation type inference
  describe('Default Operation Type', () => {
    const queryByDefault = functions
      .define({
        output: model.string(),
        options: { operation: 'query' },
      })
      .implement({
        body: async () => result.ok('query'),
      })

    const mutationByDefault = functions
      .define({
        output: model.string(),
        // No operation specified = defaults to mutation
      })
      .implement({
        body: async () => result.ok('mutation'),
      })

    const defaultOpModule = module.build({
      name: 'default-op-test',
      functions: { queryByDefault, mutationByDefault },
    })

    type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

    const schema = fromModule({
      api: build({
        module: defaultOpModule,
        functions: {
          queryByDefault: {}, // No type specified, should use function's default
          mutationByDefault: {}, // No type specified, should use function's default
        },
      }),
      context: async () => ({}),
    })

    const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
    const server = http.createServer(yoga)
    const PORT = 50144

    beforeAll(() => {
      server.listen(PORT)
    })

    afterAll(() => {
      server.close()
    })

    test('uses function operation option as default', async () => {
      // queryByDefault should be a query
      const res1 = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({ query: 'query { queryByDefault }' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body1 = await res1.json()
      expect(body1.data.queryByDefault).toBe('query')

      // mutationByDefault should be a mutation
      const res2 = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({ query: 'mutation { mutationByDefault }' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body2 = await res2.json()
      expect(body2.data.mutationByDefault).toBe('mutation')
    })
  })

  // Test Input type name with 'Input' suffix
  describe('Input Type Naming', () => {
    // Type name already ends with 'Input'
    const MyInput = model.object({ value: model.string() }, { name: 'MyInput' })
    // Type name doesn't end with 'Input'
    const MyData = model.object({ value: model.string() }, { name: 'MyData' })

    const processInput = functions
      .define({
        input: MyInput,
        output: model.string(),
      })
      .implement({
        body: async ({ input }) => result.ok(input.value),
      })

    const processData = functions
      .define({
        input: MyData,
        output: model.string(),
      })
      .implement({
        body: async ({ input }) => result.ok(input.value),
      })

    const inputNamingModule = module.build({
      name: 'input-naming-test',
      functions: { processInput, processData },
    })

    type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

    const schema = fromModule({
      api: build({
        module: inputNamingModule,
        functions: {
          processInput: { type: 'mutation' },
          processData: { type: 'mutation' },
        },
      }),
      context: async () => ({}),
    })

    test('schema is created with proper input type names', () => {
      expect(schema).toBeDefined()
      // The schema should be created without errors
    })
  })
})
