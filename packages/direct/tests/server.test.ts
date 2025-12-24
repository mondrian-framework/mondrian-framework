import { build as buildApi } from '../src/api'
import { build } from '../src/client'
import { serveWithFastify } from '../src/server/fastify'
import { api } from './module.util'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { fastify } from 'fastify'
import { expect, test, describe } from 'vitest'

describe('fastify server', () => {
  test('basic server with introspection enabled', async () => {
    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context(serverContext, metadata) {
        return {}
      },
      options: { introspection: true },
    })
    const address = await server.listen({ port: 1234 })

    const client = build({ endpoint: `${address}/mondrian`, api })
    const r1 = await client.functions.ping(123)
    expect(r1).toBe(123)

    // Test introspection GET endpoint
    const r2 = await fetch(`${address}/mondrian`, { redirect: 'manual' })
    expect(r2.status).toBe(200)
    const body = await r2.json()
    expect(body).toBeDefined()
    expect(body.name).toBe('test')

    await server.close()
  })

  test('server with introspection disabled (default)', async () => {
    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context(serverContext, metadata) {
        return {}
      },
      // No options provided, introspection defaults to false
    })
    const address = await server.listen({ port: 1235 })

    const client = build({ endpoint: `${address}/mondrian`, api })
    const r1 = await client.functions.ping(456)
    expect(r1).toBe(456)

    // GET endpoint should not be registered when introspection is false
    const r2 = await fetch(`${address}/mondrian`, { method: 'GET' })
    expect(r2.status).toBe(404)

    await server.close()
  })

  test('server with custom path', async () => {
    const customApi = buildApi({
      exclusions: {},
      module: module.build({
        name: 'custom-path-test',
        functions: {
          echo: functions
            .define({
              input: model.string(),
              output: model.string(),
            })
            .implement({
              async body({ input }) {
                return result.ok(input)
              },
            }),
        },
      }),
      options: { path: '/custom-api' },
    })

    const server = fastify()
    serveWithFastify({
      server,
      api: customApi,
      async context() {
        return {}
      },
    })
    const address = await server.listen({ port: 1236 })

    const client = build({ endpoint: `${address}/custom-api`, api: customApi })
    const r1 = await client.functions.echo('hello')
    expect(r1).toBe('hello')

    await server.close()
  })

  test('server context should receive request and reply', async () => {
    let receivedContext: any = null

    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context(serverContext, metadata) {
        receivedContext = serverContext
        return {}
      },
    })
    const address = await server.listen({ port: 1237 })

    const client = build({ endpoint: `${address}/mondrian`, api })
    await client.functions.ping(789)

    expect(receivedContext).toBeDefined()
    expect(receivedContext.request).toBeDefined()
    expect(receivedContext.reply).toBeDefined()

    await server.close()
  })

  test('server should handle function with errors', async () => {
    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context() {
        return {}
      },
    })
    const address = await server.listen({ port: 1238 })

    const client = build({ endpoint: `${address}/mondrian`, api })

    // Test successful division
    const r1 = await client.functions.divideBy({ dividend: 10, divisor: 2 })
    expect(r1.isOk && r1.value).toBe(5)

    // Test division by zero error
    const r2 = await client.functions.divideBy({ dividend: 10, divisor: 0 })
    expect(r2.isFailure && r2.error).toEqual({ dividingByZero: 'divisor is 0' })

    await server.close()
  })

  test('server should handle function with retrieve', async () => {
    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context() {
        return {}
      },
    })
    const address = await server.listen({ port: 1239 })

    const client = build({ endpoint: `${address}/mondrian`, api })

    // Full result
    const r1 = await client.functions.getUsers()
    expect(r1).toEqual([{ name: 'John' }])

    // With select (empty)
    const r2 = await client.functions.getUsers(undefined, { retrieve: { select: {} } })
    expect(r2).toEqual([{}])

    await server.close()
  })

  test('server should pass metadata to context', async () => {
    let receivedMetadata: Record<string, string> | undefined = undefined

    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context(serverContext, metadata) {
        receivedMetadata = metadata
        return {}
      },
    })
    const address = await server.listen({ port: 1240 })

    const client = build({ endpoint: `${address}/mondrian`, api }).withMetadata({ userId: '123', role: 'admin' })
    await client.functions.ping(1)

    expect(receivedMetadata).toEqual({ userId: '123', role: 'admin' })

    await server.close()
  })

  test('server should handle function that throws', async () => {
    const server = fastify()
    serveWithFastify({
      server,
      api,
      async context() {
        return {}
      },
    })
    const address = await server.listen({ port: 1241 })

    const client = build({ endpoint: `${address}/mondrian`, api })

    await expect(client.functions.ping(-5)).rejects.toThrow('Negative ping')

    await server.close()
  })
})
