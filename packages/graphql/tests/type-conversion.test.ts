import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Type Definitions
// ============================================

const SimpleUser = model.object({
  id: model.string(),
  name: model.string(),
  age: model.integer(),
})

const Address = model.object({
  street: model.string(),
  city: model.string(),
  zipCode: model.string(),
})

const UserWithAddress = model.object({
  id: model.string(),
  name: model.string(),
  address: Address,
})

const OptionalFieldsObject = model.object({
  required: model.string(),
  optional: model.optional(model.string()),
  nullable: model.nullable(model.string()),
})

const ArrayTypes = model.object({
  strings: model.array(model.string()),
  numbers: model.array(model.number()),
  optionalArray: model.optional(model.array(model.string())),
})

// ============================================
// Function Definitions
// ============================================

const echoString = functions
  .define({
    input: model.string(),
    output: model.string(),
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const echoNumber = functions
  .define({
    input: model.number(),
    output: model.number(),
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const echoInteger = functions
  .define({
    input: model.integer(),
    output: model.integer(),
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const echoBoolean = functions
  .define({
    input: model.boolean(),
    output: model.boolean(),
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const getSimpleUser = functions
  .define({
    input: model.string(),
    output: SimpleUser,
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        name: 'John Doe',
        age: 30,
      }),
  })

const getUserWithAddress = functions
  .define({
    input: model.string(),
    output: UserWithAddress,
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        name: 'Jane Doe',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          zipCode: '12345',
        },
      }),
  })

const getOptionalFields = functions
  .define({
    input: model.object({
      includeOptional: model.boolean(),
      includeNullable: model.boolean(),
    }),
    output: OptionalFieldsObject,
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        required: 'always present',
        optional: input.includeOptional ? 'optional value' : undefined,
        nullable: input.includeNullable ? 'nullable value' : null,
      }),
  })

const getArrays = functions
  .define({
    output: ArrayTypes,
  })
  .implement({
    body: async () =>
      result.ok({
        strings: ['a', 'b', 'c'],
        numbers: [1, 2, 3],
        optionalArray: ['x', 'y'],
      }),
  })

const noInputFunction = functions
  .define({
    output: model.string(),
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok('no input needed'),
  })

// ============================================
// Module Setup
// ============================================

const typeTestModule = module.build({
  name: 'type-tests',
  functions: {
    echoString,
    echoNumber,
    echoInteger,
    echoBoolean,
    getSimpleUser,
    getUserWithAddress,
    getOptionalFields,
    getArrays,
    noInputFunction,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: typeTestModule,
    functions: {
      echoString: { type: 'query' },
      echoNumber: { type: 'query' },
      echoInteger: { type: 'query' },
      echoBoolean: { type: 'query' },
      getSimpleUser: { type: 'query' },
      getUserWithAddress: { type: 'query' },
      getOptionalFields: { type: 'query' },
      getArrays: { type: 'query' },
      noInputFunction: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Type Conversion Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50125

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

  describe('Scalar Types', () => {
    test('handles string input and output', async () => {
      const res = await makeRequest('query { echoString(input: "hello world") }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { echoString: 'hello world' } })
    })

    test('handles number input and output', async () => {
      const res = await makeRequest('query { echoNumber(input: 3.14159) }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { echoNumber: 3.14159 } })
    })

    test('handles integer input and output', async () => {
      const res = await makeRequest('query { echoInteger(input: 42) }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { echoInteger: 42 } })
    })

    test('handles boolean true', async () => {
      const res = await makeRequest('query { echoBoolean(input: true) }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { echoBoolean: true } })
    })

    test('handles boolean false', async () => {
      const res = await makeRequest('query { echoBoolean(input: false) }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { echoBoolean: false } })
    })
  })

  describe('Object Types', () => {
    test('returns simple object', async () => {
      const res = await makeRequest(`
        query {
          getSimpleUser(input: "user-1") {
            id
            name
            age
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getSimpleUser).toEqual({
        id: 'user-1',
        name: 'John Doe',
        age: 30,
      })
    })

    test('returns nested object', async () => {
      const res = await makeRequest(`
        query {
          getUserWithAddress(input: "user-2") {
            id
            name
            address {
              street
              city
              zipCode
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getUserWithAddress).toEqual({
        id: 'user-2',
        name: 'Jane Doe',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          zipCode: '12345',
        },
      })
    })

    test('partial selection on object', async () => {
      const res = await makeRequest(`
        query {
          getSimpleUser(input: "user-1") {
            name
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getSimpleUser).toEqual({
        name: 'John Doe',
      })
    })
  })

  describe('Optional and Nullable Types', () => {
    test('returns with optional field present', async () => {
      const res = await makeRequest(`
        query {
          getOptionalFields(input: { includeOptional: true, includeNullable: false }) {
            required
            optional
            nullable
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getOptionalFields).toEqual({
        required: 'always present',
        optional: 'optional value',
        nullable: null,
      })
    })

    test('returns with optional field absent', async () => {
      const res = await makeRequest(`
        query {
          getOptionalFields(input: { includeOptional: false, includeNullable: true }) {
            required
            optional
            nullable
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getOptionalFields).toEqual({
        required: 'always present',
        optional: null,
        nullable: 'nullable value',
      })
    })
  })

  describe('Array Types', () => {
    test('returns arrays correctly', async () => {
      const res = await makeRequest(`
        query {
          getArrays {
            strings
            numbers
            optionalArray
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getArrays).toEqual({
        strings: ['a', 'b', 'c'],
        numbers: [1, 2, 3],
        optionalArray: ['x', 'y'],
      })
    })
  })

  describe('Functions without input', () => {
    test('handles function with no input', async () => {
      const res = await makeRequest('query { noInputFunction }')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { noInputFunction: 'no input needed' } })
    })
  })
})
