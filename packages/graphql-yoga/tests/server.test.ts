import { createServer } from '../src/server'
import { graphql } from '@mondrian-framework/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, test } from 'vitest'

// =============================================================================
// Tiny module/api builder reused across tests
// =============================================================================

function buildTestApi(options?: { path?: string }) {
  const greet = functions
    .define({
      input: model.string(),
      output: model.string(),
    })
    .implement({
      async body({ input }) {
        return result.ok(`Hello, ${input}!`)
      },
    })

  const boom = functions
    .define({
      input: model.string(),
      output: model.string(),
    })
    .implement({
      async body() {
        throw new Error('boom')
      },
    })

  const moduleImpl = module.build({
    name: 'test',
    functions: { greet, boom },
  })

  const api = graphql.build({
    module: moduleImpl,
    functions: {
      greet: { type: 'query' },
      boom: { type: 'query' },
    },
    options: options?.path !== undefined ? { path: options.path } : undefined,
  })

  return { api }
}

// =============================================================================
// Helpers
// =============================================================================

async function startServer(server: http.Server): Promise<{ port: number; baseUrl: (path: string) => string }> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address() as AddressInfo
  return {
    port: address.port,
    baseUrl: (path: string) => `http://127.0.0.1:${address.port}${path}`,
  }
}

async function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

// =============================================================================
// Tests
// =============================================================================

describe('createServer (http)', () => {
  let activeServer: http.Server | null = null

  afterEach(async () => {
    if (activeServer) {
      await closeServer(activeServer)
      activeServer = null
    }
  })

  test('returns an http.Server instance', () => {
    const { api } = buildTestApi()
    const server = createServer({
      api,
      context: async () => ({}),
    })
    activeServer = server

    expect(server).toBeInstanceOf(http.Server)
  })

  test('serves a graphql query at the default path /graphql', async () => {
    const { api } = buildTestApi()
    const server = createServer({
      api,
      context: async () => ({}),
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { greet(input: "World") }' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('application/json')

    const body = (await res.json()) as { data: { greet: string } }
    expect(body).toEqual({ data: { greet: 'Hello, World!' } })
  })

  test('respects custom api.options.path for the graphql endpoint', async () => {
    const { api } = buildTestApi({ path: '/custom-graphql' })
    const server = createServer({
      api,
      context: async () => ({}),
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    // Default path should NOT match
    const defaultRes = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { greet(input: "World") }' }),
    })
    expect(defaultRes.status).toBe(404)

    // Custom path should match
    const customRes = await fetch(baseUrl('/custom-graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { greet(input: "World") }' }),
    })
    expect(customRes.status).toBe(200)
    const body = (await customRes.json()) as { data: { greet: string } }
    expect(body).toEqual({ data: { greet: 'Hello, World!' } })
  })

  test('introspection is disabled by default', async () => {
    const { api } = buildTestApi()
    const server = createServer({
      api,
      context: async () => ({}),
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '{ __schema { queryType { name } } }',
      }),
    })
    const body = (await res.json()) as {
      errors?: { message: string }[]
      data?: unknown
    }
    expect(body.data == null).toBe(true)
    expect(body.errors).toBeDefined()
    expect(body.errors!.length).toBeGreaterThan(0)
    expect(body.errors!.some((e) => /introspection/i.test(e.message))).toBe(true)
  })

  test('introspection is enabled when options.introspection = true', async () => {
    const { api } = buildTestApi()
    const server = createServer({
      api,
      context: async () => ({}),
      options: {
        introspection: true,
      },
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '{ __schema { queryType { name } } }',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { __schema: { queryType: { name: string } } } }
    expect(body.data.__schema.queryType.name).toBeDefined()
  })

  test('preserves user-supplied yoga plugins when introspection is enabled', async () => {
    const { api } = buildTestApi()
    let pluginCalled = false
    const server = createServer({
      api,
      context: async () => ({}),
      options: {
        introspection: true,
        plugins: [
          {
            onRequest() {
              pluginCalled = true
            },
          },
        ],
      },
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { greet(input: "World") }' }),
    })
    expect(res.status).toBe(200)
    expect(pluginCalled).toBe(true)
  })

  test('preserves user-supplied yoga plugins when introspection is disabled', async () => {
    const { api } = buildTestApi()
    let pluginCalled = false
    const server = createServer({
      api,
      context: async () => ({}),
      options: {
        plugins: [
          {
            onRequest() {
              pluginCalled = true
            },
          },
        ],
      },
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { greet(input: "World") }' }),
    })
    expect(res.status).toBe(200)
    expect(pluginCalled).toBe(true)
  })

  test('invokes onError callback when a function throws', async () => {
    const { api } = buildTestApi()
    const errors: unknown[] = []
    const server = createServer({
      api,
      context: async () => ({}),
      onError: async ({ error }) => {
        errors.push(error)
        return { message: 'wrapped error message' }
      },
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { boom(input: "x") }' }),
    })
    // graphql-yoga returns 200 with errors in the body for resolver-level errors
    expect(res.status).toBe(200)
    const body = (await res.json()) as { errors?: { message: string }[]; data: unknown }
    expect(errors.length).toBe(1)
    expect((errors[0] as Error).message).toBe('boom')
    expect(body.errors).toBeDefined()
    expect(body.errors!.some((e) => e.message === 'wrapped error message')).toBe(true)
  })

  test('context callback receives the server context with req and res', async () => {
    const { api } = buildTestApi()
    let capturedReq: http.IncomingMessage | undefined
    let capturedRes: http.ServerResponse | undefined
    const server = createServer({
      api,
      context: async ({ req, res }) => {
        capturedReq = req
        capturedRes = res
        return {}
      },
    })
    activeServer = server

    const { baseUrl } = await startServer(server)

    const res = await fetch(baseUrl('/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { greet(input: "World") }' }),
    })

    expect(res.status).toBe(200)
    expect(capturedReq).toBeDefined()
    expect(capturedRes).toBeDefined()
    expect(capturedReq!.method).toBe('POST')
  })
})
