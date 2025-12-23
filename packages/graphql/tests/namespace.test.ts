import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Namespace Functions
// ============================================

const userGetById = functions
  .define({
    input: model.string(),
    output: model.object({ id: model.string(), name: model.string() }),
    options: { namespace: 'user' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        name: 'John User',
      }),
  })

const userCreate = functions
  .define({
    input: model.object({ name: model.string() }),
    output: model.object({ id: model.string(), name: model.string() }),
    options: { namespace: 'user' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: 'new-id',
        name: input.name,
      }),
  })

const userUpdate = functions
  .define({
    input: model.object({ id: model.string(), name: model.string() }),
    output: model.object({ id: model.string(), name: model.string() }),
    options: { namespace: 'user' },
  })
  .implement({
    body: async ({ input }) => result.ok(input),
  })

const productGetById = functions
  .define({
    input: model.string(),
    output: model.object({ id: model.string(), title: model.string(), price: model.number() }),
    options: { namespace: 'product' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        title: 'Product',
        price: 99.99,
      }),
  })

const productList = functions
  .define({
    output: model.array(model.object({ id: model.string(), title: model.string() })),
    options: { namespace: 'product', operation: 'query' },
  })
  .implement({
    body: async () =>
      result.ok([
        { id: 'p1', title: 'Product 1' },
        { id: 'p2', title: 'Product 2' },
      ]),
  })

// Top-level (no namespace) functions
const healthCheck = functions
  .define({
    output: model.object({ status: model.string(), timestamp: model.datetime() }),
    options: { operation: 'query' },
  })
  .implement({
    body: async () =>
      result.ok({
        status: 'healthy',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      }),
  })

const ping = functions
  .define({
    output: model.literal('pong'),
    options: { operation: 'query' },
  })
  .implement({
    body: async () => result.ok('pong'),
  })

// ============================================
// Module Setup
// ============================================

const namespaceModule = module.build({
  name: 'namespace-tests',
  functions: {
    userGetById,
    userCreate,
    userUpdate,
    productGetById,
    productList,
    healthCheck,
    ping,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: namespaceModule,
    functions: {
      userGetById: { type: 'query', name: 'getById' },
      userCreate: { type: 'mutation', name: 'create' },
      userUpdate: { type: 'mutation', name: 'update' },
      productGetById: { type: 'query', name: 'getById' },
      productList: { type: 'query', name: 'list' },
      healthCheck: { type: 'query' },
      ping: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Namespace Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50130

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

  describe('Namespaced Queries', () => {
    test('accesses user namespace query', async () => {
      const res = await makeRequest(`
        query {
          user {
            getById(input: "user-1") {
              id
              name
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.user.getById).toEqual({
        id: 'user-1',
        name: 'John User',
      })
    })

    test('accesses product namespace query', async () => {
      const res = await makeRequest(`
        query {
          product {
            getById(input: "prod-1") {
              id
              title
              price
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.product.getById).toEqual({
        id: 'prod-1',
        title: 'Product',
        price: 99.99,
      })
    })

    test('accesses multiple namespaces in same query', async () => {
      const res = await makeRequest(`
        query {
          user {
            getById(input: "user-1") {
              id
            }
          }
          product {
            list {
              id
              title
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.user.getById.id).toBe('user-1')
      expect(res.body.data.product.list).toHaveLength(2)
    })
  })

  describe('Namespaced Mutations', () => {
    test('accesses user namespace mutation', async () => {
      const res = await makeRequest(`
        mutation {
          user {
            create(input: { name: "New User" }) {
              id
              name
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.user.create).toEqual({
        id: 'new-id',
        name: 'New User',
      })
    })

    test('accesses multiple mutations in same namespace', async () => {
      const res = await makeRequest(`
        mutation {
          user {
            create(input: { name: "Created User" }) {
              id
              name
            }
            update(input: { id: "existing", name: "Updated User" }) {
              id
              name
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.user.create.name).toBe('Created User')
      expect(res.body.data.user.update.name).toBe('Updated User')
    })
  })

  describe('Top-level Operations (No Namespace)', () => {
    test('healthCheck query at root level', async () => {
      const res = await makeRequest(`
        query {
          healthCheck {
            status
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.healthCheck.status).toBe('healthy')
    })

    test('ping query at root level', async () => {
      const res = await makeRequest(`
        query {
          ping
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.ping).toBe('pong')
    })

    test('combines root and namespaced queries', async () => {
      const res = await makeRequest(`
        query {
          ping
          healthCheck {
            status
          }
          user {
            getById(input: "u1") {
              name
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.ping).toBe('pong')
      expect(res.body.data.healthCheck.status).toBe('healthy')
      expect(res.body.data.user.getById.name).toBe('John User')
    })
  })
})

describe('Empty Namespaces', () => {
  // Test case where some namespaces have no operations
  const emptyNamespaceModule = module.build({
    name: 'empty-namespace-tests',
    functions: {
      onlyQuery: functions
        .define({
          output: model.string(),
          options: { operation: 'query' },
        })
        .implement({
          body: async () => result.ok('query only'),
        }),
    },
  })

  const emptySchema = fromModule({
    api: build({
      module: emptyNamespaceModule,
      functions: {
        onlyQuery: { type: 'query' },
      },
    }),
    context: async () => ({}),
  })

  const emptyYoga = createYoga<ServerContext>({ schema: emptySchema, maskedErrors: false })
  const emptyServer = http.createServer(emptyYoga)
  const PORT = 50131

  beforeAll(() => {
    emptyServer.listen(PORT)
  })

  afterAll(() => {
    emptyServer.close()
  })

  test('schema works with only queries (empty mutations)', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: 'query { onlyQuery }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.onlyQuery).toBe('query only')
  })

  test('mutations have void placeholder', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: 'mutation { void }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.void).toBe('void')
  })
})
