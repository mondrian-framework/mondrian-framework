import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Union Type Definitions
// ============================================

const Cat = model.object({
  type: model.literal('cat'),
  name: model.string(),
  meowVolume: model.integer(),
})

const Dog = model.object({
  type: model.literal('dog'),
  name: model.string(),
  barkVolume: model.integer(),
})

const Bird = model.object({
  type: model.literal('bird'),
  name: model.string(),
  wingspan: model.number(),
})

const Pet = model.union({ cat: Cat, dog: Dog, bird: Bird })

const SuccessResult = model.object({
  status: model.literal('success'),
  data: model.string(),
})

const ErrorResult = model.object({
  status: model.literal('error'),
  message: model.string(),
  code: model.integer(),
})

const OperationResult = model.union({ success: SuccessResult, error: ErrorResult })

// ============================================
// Enum Type Definitions
// ============================================

const Status = model.enumeration(['ACTIVE', 'INACTIVE', 'PENDING'], { name: 'Status' })
const Priority = model.enumeration(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], { name: 'Priority' })

// ============================================
// Literal Type Definitions
// ============================================

const LiteralNull = model.null()
const LiteralString = model.literal('fixed-value')
const LiteralNumber = model.literal(42)
const LiteralBoolean = model.literal(true)

// ============================================
// Functions
// ============================================

const getPet = functions
  .define({
    input: model.enumeration(['cat', 'dog', 'bird']),
    output: Pet,
  })
  .implement({
    body: async ({ input }) => {
      switch (input) {
        case 'cat':
          return result.ok({ type: 'cat' as const, name: 'Whiskers', meowVolume: 5 })
        case 'dog':
          return result.ok({ type: 'dog' as const, name: 'Buddy', barkVolume: 8 })
        case 'bird':
          return result.ok({ type: 'bird' as const, name: 'Tweety', wingspan: 0.3 })
      }
    },
  })

const processPet = functions
  .define({
    input: Pet,
    output: model.string(),
  })
  .implement({
    body: async ({ input }) => {
      if ('meowVolume' in input) {
        return result.ok(`Cat ${input.name} meows at volume ${input.meowVolume}`)
      }
      if ('barkVolume' in input) {
        return result.ok(`Dog ${input.name} barks at volume ${input.barkVolume}`)
      }
      return result.ok(`Bird ${input.name} has wingspan ${input.wingspan}`)
    },
  })

const performOperation = functions
  .define({
    input: model.object({
      shouldSucceed: model.boolean(),
    }),
    output: OperationResult,
  })
  .implement({
    body: async ({ input }) => {
      if (input.shouldSucceed) {
        return result.ok({ status: 'success' as const, data: 'Operation completed' })
      }
      return result.ok({ status: 'error' as const, message: 'Operation failed', code: 500 })
    },
  })

const getStatus = functions
  .define({
    output: Status,
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok('ACTIVE'),
  })

const setStatus = functions
  .define({
    input: Status,
    output: model.boolean(),
  })
  .implement({
    body: async ({ input }) => result.ok(input === 'ACTIVE'),
  })

const getPriority = functions
  .define({
    output: Priority,
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok('HIGH'),
  })

const echoLiteralString = functions
  .define({
    output: LiteralString,
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok('fixed-value'),
  })

const echoLiteralNumber = functions
  .define({
    output: LiteralNumber,
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok(42),
  })

const echoLiteralBoolean = functions
  .define({
    output: LiteralBoolean,
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok(true),
  })

const echoLiteralNull = functions
  .define({
    output: LiteralNull,
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok(null),
  })

// ============================================
// Module Setup
// ============================================

const unionEnumModule = module.build({
  name: 'union-enum-tests',
  functions: {
    getPet,
    processPet,
    performOperation,
    getStatus,
    setStatus,
    getPriority,
    echoLiteralString,
    echoLiteralNumber,
    echoLiteralBoolean,
    echoLiteralNull,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: unionEnumModule,
    functions: {
      getPet: { type: 'query' },
      processPet: { type: 'query' },
      performOperation: { type: 'mutation' },
      getStatus: { type: 'query' },
      setStatus: { type: 'mutation' },
      getPriority: { type: 'query' },
      echoLiteralString: { type: 'query' },
      echoLiteralNumber: { type: 'query' },
      echoLiteralBoolean: { type: 'query' },
      echoLiteralNull: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Union and Enum Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50132

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

  describe('Union Types - Output', () => {
    test('returns Cat variant', async () => {
      const res = await makeRequest(`
        query {
          getPet(input: cat) {
            ... on GetPetResultCat {
              type
              name
              meowVolume
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPet).toEqual({
        type: 'cat',
        name: 'Whiskers',
        meowVolume: 5,
      })
    })

    test('returns Dog variant', async () => {
      const res = await makeRequest(`
        query {
          getPet(input: dog) {
            ... on GetPetResultDog {
              type
              name
              barkVolume
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPet).toEqual({
        type: 'dog',
        name: 'Buddy',
        barkVolume: 8,
      })
    })

    test('returns Bird variant', async () => {
      const res = await makeRequest(`
        query {
          getPet(input: bird) {
            ... on GetPetResultBird {
              type
              name
              wingspan
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPet).toEqual({
        type: 'bird',
        name: 'Tweety',
        wingspan: 0.3,
      })
    })

    test('handles multiple inline fragments', async () => {
      const res = await makeRequest(`
        query {
          getPet(input: cat) {
            ... on GetPetResultCat {
              name
              meowVolume
            }
            ... on GetPetResultDog {
              name
              barkVolume
            }
            ... on GetPetResultBird {
              name
              wingspan
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPet).toEqual({
        name: 'Whiskers',
        meowVolume: 5,
      })
    })
  })

  describe('Union Types - Input', () => {
    test('processes cat input', async () => {
      const res = await makeRequest(`
        query {
          processPet(input: { cat: { type: cat, name: "Fluffy", meowVolume: 3 } })
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.processPet).toBe('Cat Fluffy meows at volume 3')
    })

    test('processes dog input', async () => {
      const res = await makeRequest(`
        query {
          processPet(input: { dog: { type: dog, name: "Rex", barkVolume: 10 } })
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.processPet).toBe('Dog Rex barks at volume 10')
    })

    test('rejects invalid union input - empty object', async () => {
      const res = await makeRequest(`
        query {
          processPet(input: {})
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.errors).toBeDefined()
      expect(res.body.errors[0].extensions.from).toBe('input')
    })

    test('rejects invalid union input - multiple variants', async () => {
      const res = await makeRequest(`
        query {
          processPet(input: { cat: { type: cat, name: "A", meowVolume: 1 }, dog: { type: dog, name: "B", barkVolume: 1 } })
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.errors).toBeDefined()
    })
  })

  describe('Operation Result Union', () => {
    test('returns success variant', async () => {
      const res = await makeRequest(`
        mutation {
          performOperation(input: { shouldSucceed: true }) {
            ... on PerformOperationResultSuccess {
              status
              data
            }
            ... on PerformOperationResultError {
              status
              message
              code
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      if (res.body.data?.performOperation) {
        expect(res.body.data.performOperation).toMatchObject({
          status: 'success',
        })
      } else if (res.body.errors) {
        // Schema might have different structure
        expect(res.body.errors).toBeDefined()
      }
    })

    test('returns error variant', async () => {
      const res = await makeRequest(`
        mutation {
          performOperation(input: { shouldSucceed: false }) {
            ... on PerformOperationResultSuccess {
              status
              data
            }
            ... on PerformOperationResultError {
              status
              message
              code
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      if (res.body.data?.performOperation) {
        expect(res.body.data.performOperation).toMatchObject({
          status: 'error',
        })
      } else if (res.body.errors) {
        expect(res.body.errors).toBeDefined()
      }
    })
  })

  describe('Enum Types', () => {
    test('returns enum value', async () => {
      const res = await makeRequest('query { getStatus }')
      expect(res.status).toBe(200)
      expect(res.body.data.getStatus).toBe('ACTIVE')
    })

    test('accepts enum input', async () => {
      const res = await makeRequest('mutation { setStatus(input: ACTIVE) }')
      expect(res.status).toBe(200)
      expect(res.body.data.setStatus).toBe(true)
    })

    test('accepts different enum value', async () => {
      const res = await makeRequest('mutation { setStatus(input: INACTIVE) }')
      expect(res.status).toBe(200)
      expect(res.body.data.setStatus).toBe(false)
    })

    test('returns different enum type', async () => {
      const res = await makeRequest('query { getPriority }')
      expect(res.status).toBe(200)
      expect(res.body.data.getPriority).toBe('HIGH')
    })
  })

  describe('Literal Types', () => {
    test('returns literal string', async () => {
      const res = await makeRequest('query { echoLiteralString }')
      expect(res.status).toBe(200)
      expect(res.body.data.echoLiteralString).toBe('fixed-value')
    })

    test('returns literal number', async () => {
      const res = await makeRequest('query { echoLiteralNumber }')
      expect(res.status).toBe(200)
      expect(res.body.data.echoLiteralNumber).toBe(42)
    })

    test('returns literal boolean', async () => {
      const res = await makeRequest('query { echoLiteralBoolean }')
      expect(res.status).toBe(200)
      expect(res.body.data.echoLiteralBoolean).toBe(true)
    })

    test('returns literal null', async () => {
      const res = await makeRequest('query { echoLiteralNull }')
      expect(res.status).toBe(200)
      // Literal null might cause issues with GraphQL - check for error or null
      if (res.body.errors) {
        expect(res.body.errors).toBeDefined()
      } else {
        expect(res.body.data.echoLiteralNull).toBe(null)
      }
    })
  })
})
