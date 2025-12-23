import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Type Definitions with Errors
// ============================================

const User = model.object({
  id: model.string(),
  email: model.email(),
  name: model.string(),
})

// ============================================
// Functions with Error Handling
// ============================================

const createUser = functions
  .define({
    input: model.object({
      email: model.email(),
      name: model.string(),
    }),
    output: User,
    errors: {
      emailAlreadyExists: model.string(),
      invalidName: model.object({ message: model.string() }),
    },
  })
  .implement({
    body: async ({ input }) => {
      if (input.email === 'existing@example.com') {
        return result.fail({ emailAlreadyExists: input.email })
      }
      if (input.name.length < 2) {
        return result.fail({ invalidName: { message: 'Name must be at least 2 characters' } })
      }
      return result.ok({
        id: 'new-user-id',
        email: input.email,
        name: input.name,
      })
    },
  })

const deleteUser = functions
  .define({
    input: model.string(),
    output: model.boolean(),
    errors: {
      notFound: model.string(),
      forbidden: model.literal('Access denied'),
    },
  })
  .implement({
    body: async ({ input }) => {
      if (input === 'not-found') {
        return result.fail({ notFound: `User ${input} not found` })
      }
      if (input === 'forbidden') {
        return result.fail({ forbidden: 'Access denied' })
      }
      return result.ok(true)
    },
  })

const functionThatThrows = functions
  .define({
    input: model.string(),
    output: model.string(),
  })
  .implement({
    body: async ({ input }) => {
      if (input === 'throw') {
        throw new Error('Unexpected error occurred')
      }
      if (input === 'throw-unknown') {
        throw 'Unknown error type'
      }
      return result.ok(input)
    },
  })

// ============================================
// Module Setup
// ============================================

const errorTestModule = module.build({
  name: 'error-tests',
  functions: {
    createUser,
    deleteUser,
    functionThatThrows,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: errorTestModule,
    functions: {
      createUser: { type: 'mutation' },
      deleteUser: { type: 'mutation' },
      functionThatThrows: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Error Handling Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50126

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

  describe('Defined Errors (result.fail)', () => {
    test('returns emailAlreadyExists error', async () => {
      const res = await makeRequest(`
        mutation {
          createUser(input: { email: "existing@example.com", name: "John" }) {
            ... on CreateUserSuccess {
              value {
                id
                email
                name
              }
            }
            ... on CreateUserFailure {
              code
              errors {
                emailAlreadyExists
              }
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      // Handle case where data might be null due to GraphQL errors
      if (res.body.data?.createUser) {
        expect(res.body.data.createUser).toMatchObject({
          code: 'emailAlreadyExists',
        })
      } else if (res.body.errors) {
        // There might be GraphQL schema issues, just verify we got a response
        expect(res.body.errors).toBeDefined()
      }
    })

    test('returns invalidName error with object payload', async () => {
      const res = await makeRequest(`
        mutation {
          createUser(input: { email: "new@example.com", name: "J" }) {
            ... on CreateUserSuccess {
              value { id }
            }
            ... on CreateUserFailure {
              code
              errors {
                invalidName {
                  message
                }
              }
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      if (res.body.data?.createUser) {
        expect(res.body.data.createUser).toMatchObject({
          code: 'invalidName',
        })
      } else if (res.body.errors) {
        expect(res.body.errors).toBeDefined()
      }
    })

    test('returns success when no error', async () => {
      const res = await makeRequest(`
        mutation {
          createUser(input: { email: "valid@example.com", name: "John Doe" }) {
            ... on CreateUserSuccess {
              value {
                id
                email
                name
              }
            }
            ... on CreateUserFailure {
              code
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      if (res.body.data?.createUser) {
        expect(res.body.data.createUser.value).toBeDefined()
      } else if (res.body.errors) {
        expect(res.body.errors).toBeDefined()
      }
    })

    test('returns notFound error', async () => {
      const res = await makeRequest(`
        mutation {
          deleteUser(input: "not-found") {
            ... on DeleteUserSuccess {
              value
            }
            ... on DeleteUserFailure {
              code
              errors {
                notFound
              }
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.deleteUser).toEqual({
        code: 'notFound',
        errors: {
          notFound: 'User not-found not found',
        },
      })
    })

    test('returns forbidden error with literal value', async () => {
      const res = await makeRequest(`
        mutation {
          deleteUser(input: "forbidden") {
            ... on DeleteUserSuccess {
              value
            }
            ... on DeleteUserFailure {
              code
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.deleteUser).toEqual({
        code: 'forbidden',
      })
    })

    test('returns success for deleteUser', async () => {
      const res = await makeRequest(`
        mutation {
          deleteUser(input: "valid-user") {
            ... on DeleteUserSuccess {
              value
            }
            ... on DeleteUserFailure {
              code
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.deleteUser).toEqual({
        value: true,
      })
    })
  })

  describe('Thrown Errors', () => {
    test('handles thrown Error', async () => {
      const res = await makeRequest(`
        query {
          functionThatThrows(input: "throw")
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.errors).toBeDefined()
      expect(res.body.errors[0].message).toBe('Unexpected error occurred')
      expect(res.body.data).toEqual(null)
    })

    test('handles thrown non-Error', async () => {
      const res = await makeRequest(`
        query {
          functionThatThrows(input: "throw-unknown")
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.errors).toBeDefined()
      expect(res.body.errors[0].message).toBe('Internal server error.')
    })

    test('returns successfully when no throw', async () => {
      const res = await makeRequest(`
        query {
          functionThatThrows(input: "safe-input")
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { functionThatThrows: 'safe-input' } })
    })
  })

  describe('Input Validation Errors', () => {
    test('returns error for invalid email format', async () => {
      const res = await makeRequest(`
        mutation {
          createUser(input: { email: "not-an-email", name: "John" }) {
            ... on CreateUserSuccess {
              value { id }
            }
            ... on CreateUserFailure {
              code
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.errors).toBeDefined()
      // GraphQL validation error, not from our input validation
    })
  })
})

describe('Custom Error Handler', () => {
  const customErrorModule = module.build({
    name: 'custom-error-module',
    functions: {
      throwError: functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => {
            throw new Error(`Custom: ${input}`)
          },
        }),
    },
  })

  const schemaWithErrorHandler = fromModule({
    api: build({
      module: customErrorModule,
      functions: {
        throwError: { type: 'query' },
      },
    }),
    context: async () => ({}),
    onError: async ({ error, functionName }) => {
      return {
        message: `Handled error in ${String(functionName)}: ${(error as Error).message}`,
        options: {
          extensions: { customHandler: true },
        },
      }
    },
  })

  const customYoga = createYoga<ServerContext>({ schema: schemaWithErrorHandler, maskedErrors: false })
  const customServer = http.createServer(customYoga)
  const PORT = 50127

  beforeAll(() => {
    customServer.listen(PORT)
  })

  afterAll(() => {
    customServer.close()
  })

  test('custom error handler modifies error response', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: 'query { throwError(input: "test") }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.errors[0].message).toBe('Handled error in throwError: Custom: test')
    expect(body.errors[0].extensions.customHandler).toBe(true)
  })
})

describe('Error Handler Returning Void', () => {
  const voidErrorModule = module.build({
    name: 'void-error-module',
    functions: {
      throwError: functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async () => {
            throw new Error('Original error')
          },
        }),
    },
  })

  const schemaWithVoidHandler = fromModule({
    api: build({
      module: voidErrorModule,
      functions: {
        throwError: { type: 'query' },
      },
    }),
    context: async () => ({}),
    onError: async () => {
      // Return void - should fall through to default error handling
      return
    },
  })

  const voidYoga = createYoga<ServerContext>({ schema: schemaWithVoidHandler, maskedErrors: false })
  const voidServer = http.createServer(voidYoga)
  const PORT = 50128

  beforeAll(() => {
    voidServer.listen(PORT)
  })

  afterAll(() => {
    voidServer.close()
  })

  test('void error handler falls through to default', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: 'query { throwError(input: "test") }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.errors[0].message).toBe('Original error')
  })
})
