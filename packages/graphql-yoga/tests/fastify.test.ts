import { serveWithFastify } from '../src/fastify'
import { graphql } from '@mondrian-framework/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import fastify, { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

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
// Tests
// =============================================================================

describe('serveWithFastify', () => {
  let server: FastifyInstance

  beforeEach(() => {
    server = fastify()
  })

  afterEach(async () => {
    await server.close()
  })

  test('registers POST handler at default /graphql path and serves a query', async () => {
    const { api } = buildTestApi()

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
    })

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type'] ?? '').toContain('application/json')
    expect(JSON.parse(res.body)).toEqual({ data: { greet: 'Hello, World!' } })
  })

  test('registers GET handler at default /graphql path', async () => {
    const { api } = buildTestApi()

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
    })

    const query = encodeURIComponent('query { greet(input: "World") }')
    const res = await server.inject({
      method: 'GET',
      url: `/graphql?query=${query}`,
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ data: { greet: 'Hello, World!' } })
  })

  test('registers OPTIONS handler at default /graphql path', async () => {
    const { api } = buildTestApi()

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
    })

    const res = await server.inject({
      method: 'OPTIONS',
      url: '/graphql',
    })

    // OPTIONS requests should be accepted (not 404). Yoga responds with 204
    // by default, but the exact status varies — we just want to confirm the
    // route is wired.
    expect(res.statusCode).not.toBe(404)
  })

  test('uses custom api.options.path when provided', async () => {
    const { api } = buildTestApi({ path: '/custom-graphql' })

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
    })

    // Default /graphql should NOT be registered
    const defaultRes = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(defaultRes.statusCode).toBe(404)

    // Custom path should be registered
    const customRes = await server.inject({
      method: 'POST',
      url: '/custom-graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(customRes.statusCode).toBe(200)
    expect(JSON.parse(customRes.body)).toEqual({ data: { greet: 'Hello, World!' } })
  })

  test('introspection is disabled by default', async () => {
    const { api } = buildTestApi()

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
    })

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: '{ __schema { queryType { name } } }' }),
      headers: { 'content-type': 'application/json' },
    })

    const body = JSON.parse(res.body) as { errors?: { message: string }[]; data?: unknown }
    expect(body.data == null).toBe(true)
    expect(body.errors).toBeDefined()
    expect(body.errors!.some((e) => /introspection/i.test(e.message))).toBe(true)
  })

  test('introspection is enabled when options.introspection = true', async () => {
    const { api } = buildTestApi()

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
      options: {
        introspection: true,
      },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: '{ __schema { queryType { name } } }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: { __schema: { queryType: { name: string } } } }
    expect(body.data.__schema.queryType.name).toBeDefined()
  })

  test('preserves user-supplied yoga plugins when introspection is enabled', async () => {
    const { api } = buildTestApi()
    let pluginCalled = false

    serveWithFastify({
      server,
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

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(pluginCalled).toBe(true)
  })

  test('preserves user-supplied yoga plugins when introspection is disabled', async () => {
    const { api } = buildTestApi()
    let pluginCalled = false

    serveWithFastify({
      server,
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

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(pluginCalled).toBe(true)
  })

  test('invokes onError callback when a function throws', async () => {
    const { api } = buildTestApi()
    const errors: unknown[] = []

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
      onError: async ({ error }) => {
        errors.push(error)
        return { message: 'wrapped error message' }
      },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { boom(input: "x") }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { errors?: { message: string }[]; data: unknown }
    expect(errors.length).toBe(1)
    expect((errors[0] as Error).message).toBe('boom')
    expect(body.errors).toBeDefined()
    expect(body.errors!.some((e) => e.message === 'wrapped error message')).toBe(true)
  })

  test('context callback receives the fastify request/reply', async () => {
    const { api } = buildTestApi()
    let capturedRequestUrl: string | undefined
    let capturedReplyDefined = false

    serveWithFastify({
      server,
      api,
      context: async ({ fastify }) => {
        capturedRequestUrl = fastify.request.url
        capturedReplyDefined = !!fastify.reply
        return {}
      },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    expect(capturedRequestUrl).toBe('/graphql')
    expect(capturedReplyDefined).toBe(true)
  })

  test('forwards yoga response headers to fastify reply', async () => {
    const { api } = buildTestApi()

    serveWithFastify({
      server,
      api,
      context: async () => ({}),
    })

    const res = await server.inject({
      method: 'POST',
      url: '/graphql',
      payload: JSON.stringify({ query: 'query { greet(input: "World") }' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    // Yoga sets a content-type header — verify it's on the reply.
    expect(res.headers['content-type']).toBeDefined()
    expect(String(res.headers['content-type'])).toContain('application/json')
  })
})
