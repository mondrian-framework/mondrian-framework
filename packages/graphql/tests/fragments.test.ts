import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Test Fragment Usage
// ============================================

const Address = model.object({
  street: model.string(),
  city: model.string(),
  country: model.string(),
})

const Person = model.object({
  id: model.string(),
  name: model.string(),
  email: model.email(),
  address: Address,
})

const Company = model.object({
  id: model.string(),
  name: model.string(),
  address: Address,
  employees: model.array(Person),
})

// ============================================
// Functions
// ============================================

const getPerson = functions
  .define({
    input: model.string(),
    output: Person,
    options: { operation: 'query' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        name: 'John Person',
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA',
        },
      }),
  })

const getCompany = functions
  .define({
    input: model.string(),
    output: Company,
    options: { operation: 'query' },
  })
  .implement({
    body: async ({ input }) =>
      result.ok({
        id: input,
        name: 'Acme Corp',
        address: {
          street: '456 Business Ave',
          city: 'Los Angeles',
          country: 'USA',
        },
        employees: [
          {
            id: 'emp-1',
            name: 'Alice',
            email: 'alice@acme.com',
            address: { street: '789 Worker St', city: 'Chicago', country: 'USA' },
          },
          {
            id: 'emp-2',
            name: 'Bob',
            email: 'bob@acme.com',
            address: { street: '321 Employee Rd', city: 'Miami', country: 'USA' },
          },
        ],
      }),
  })

// ============================================
// Module Setup
// ============================================

const fragmentModule = module.build({
  name: 'fragment-tests',
  functions: {
    getPerson,
    getCompany,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: fragmentModule,
    functions: {
      getPerson: { type: 'query' },
      getCompany: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Fragment Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50134

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

  describe('Named Fragments', () => {
    test('uses named fragment for address', async () => {
      const res = await makeRequest(`
        query {
          getPerson(input: "person-1") {
            id
            name
            address {
              street
              city
              country
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPerson).toEqual({
        id: 'person-1',
        name: 'John Person',
        address: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA',
        },
      })
    })

    test('uses same fragment in multiple places', async () => {
      const res = await makeRequest(`
        query {
          getCompany(input: "company-1") {
            id
            name
            address {
              street
              city
            }
            employees {
              name
              address {
                city
                country
              }
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getCompany.address).toEqual({
        street: '456 Business Ave',
        city: 'Los Angeles',
      })
      expect(res.body.data.getCompany.employees[0].address).toEqual({
        city: 'Chicago',
        country: 'USA',
      })
    })

    test('nested fragments', async () => {
      const res = await makeRequest(`
        query {
          getCompany(input: "company-1") {
            id
            name
            address {
              street
              city
            }
            employees {
              id
              name
              email
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getCompany).toEqual({
        id: 'company-1',
        name: 'Acme Corp',
        address: {
          street: '456 Business Ave',
          city: 'Los Angeles',
        },
        employees: [
          { id: 'emp-1', name: 'Alice', email: 'alice@acme.com' },
          { id: 'emp-2', name: 'Bob', email: 'bob@acme.com' },
        ],
      })
    })
  })

  describe('Inline Fragments', () => {
    test('uses inline fragment', async () => {
      const res = await makeRequest(`
        query {
          getPerson(input: "person-1") {
            id
            name
            email
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPerson).toEqual({
        id: 'person-1',
        name: 'John Person',
        email: 'john@example.com',
      })
    })
  })

  describe('Variables with Fragments', () => {
    test('uses variables with fragments', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          query: `
            query GetPersonWithFragment($id: String!) {
              getPerson(input: $id) {
                id
                name
                address {
                  city
                }
              }
            }
          `,
          variables: { id: 'person-variable' },
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      expect(body.data.getPerson).toEqual({
        id: 'person-variable',
        name: 'John Person',
        address: {
          city: 'New York',
        },
      })
    })
  })

  describe('__typename', () => {
    test('can request __typename', async () => {
      const res = await makeRequest(`
        query {
          getPerson(input: "person-1") {
            __typename
            id
            name
          }
        }
      `)
      expect(res.status).toBe(200)
      // Type name is wrapped as GetPersonResult
      expect(res.body.data.getPerson.__typename).toBe('GetPersonResult')
      expect(res.body.data.getPerson.id).toBe('person-1')
      expect(res.body.data.getPerson.name).toBe('John Person')
    })

    test('__typename on nested objects', async () => {
      const res = await makeRequest(`
        query {
          getCompany(input: "company-1") {
            __typename
            address {
              __typename
              city
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      // Type names are wrapped - actual names may vary
      expect(res.body.data.getCompany.__typename).toContain('Company')
      expect(res.body.data.getCompany.address.__typename).toContain('Address')
    })
  })
})

describe('GraphQL Aliases', () => {
  const aliasModule = module.build({
    name: 'alias-tests',
    functions: {
      getPerson: functions
        .define({
          input: model.string(),
          output: model.object({ id: model.string(), name: model.string() }),
          options: { operation: 'query' },
        })
        .implement({
          body: async ({ input }) => result.ok({ id: input, name: `Person ${input}` }),
        }),
    },
  })

  const aliasSchema = fromModule({
    api: build({
      module: aliasModule,
      functions: {
        getPerson: { type: 'query' },
      },
    }),
    context: async () => ({}),
  })

  const aliasYoga = createYoga<ServerContext>({ schema: aliasSchema, maskedErrors: false })
  const aliasServer = http.createServer(aliasYoga)
  const PORT = 50135

  beforeAll(() => {
    aliasServer.listen(PORT)
  })

  afterAll(() => {
    aliasServer.close()
  })

  test('uses field aliases', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        query: `
          query {
            person1: getPerson(input: "1") {
              identifier: id
              fullName: name
            }
            person2: getPerson(input: "2") {
              identifier: id
              fullName: name
            }
          }
        `,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data).toEqual({
      person1: { identifier: '1', fullName: 'Person 1' },
      person2: { identifier: '2', fullName: 'Person 2' },
    })
  })
})
