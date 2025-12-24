import { DEFAULT_SERVE_OPTIONS, define } from '../src/api'
import { build as buildApi } from '../src/api'
import { build } from '../src/client'
import { fromModule, Response } from '../src/handler'
import { api, moduleInterface } from './module.util'
import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import http from 'node:http'
import { expect, test, describe } from 'vitest'

const handler = fromModule({
  api,
  async context(context, metadata) {
    if (metadata?.auth !== 'ok') {
      throw new Error('Unauthorized')
    }
    return 'ok'
  },
  options: { ...DEFAULT_SERVE_OPTIONS, introspection: true },
})
const client = build({ endpoint: handler, api }).withMetadata({ auth: 'ok' })

describe('direct client', () => {
  test('callign a function with no errors, no retrieve, should work', async () => {
    const r1 = await client.functions.ping(123)
    expect(r1).toBe(123)
  })

  test('callign a function with no errors, no retrieve, that throws (error) should throws', async () => {
    await expect(client.functions.ping(-123)).rejects.toThrow('Negative ping')
  })

  test('callign a function with no errors, no retrieve, that throws (non error) should throws', async () => {
    await expect(client.functions.ping(-1.1)).rejects.toThrow('Function throws')
  })

  test('callign a function with no errors, no retrieve but WRONG INPUT should fail', async () => {
    await expect(() => client.functions.ping('abc' as any)).rejects.toThrow('Invalid input.')
  })

  test('callign a function with no errors, retrieve and never input should work', async () => {
    const r1 = await client.functions.getUsers()
    expect(r1).toEqual([{ name: 'John' }])

    const r2 = await client.functions.getUsers(undefined, { retrieve: { select: {} } })
    expect(r2).toEqual([{}])
  })

  test('callign a function with errors, no retrieve should work', async () => {
    const r1 = await client.functions.divideBy({ dividend: 4, divisor: 2 })
    expect(r1.isOk && r1.value).toBe(2)

    const r2 = await client.functions.divideBy({ dividend: 4, divisor: 0 })
    expect(r2.isFailure && r2.error).toEqual({ dividingByZero: 'divisor is 0' })
  })

  test('omitted function should have no handler', async () => {
    expect((client.functions as any).omitted).toBe(undefined)
  })
})

describe('edge cases', () => {
  test('module without functions should throw exception', async () => {
    const r1 = await fromModule({
      api: buildApi({
        module: module.build({
          functions: {},
          name: '',
        }),

        exclusions: {},
      }),
      async context(metadata, request) {
        return {}
      },
      options: { ...DEFAULT_SERVE_OPTIONS, introspection: true },
    })({ request: { body: {}, headers: {}, method: 'post', params: {}, query: {}, route: '/' }, serverContext: null })
    expect(r1).toEqual({
      body: {
        additionalInfo: 'This module does not expose any function',
        reason: 'No function available',
        success: false,
      },
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  test('request without function name should throw exception', async () => {
    const r1 = await handler({
      request: { body: {}, headers: {}, method: 'post', params: {}, query: {}, route: '/' },
      serverContext: null,
    })
    expect(r1).toEqual({
      body: {
        additionalInfo: {
          expected: "One of ['ping', 'getUsers', 'divideBy']",
          path: '$.function',
        },
        reason: 'Error while decoding request',
        success: false,
      },
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  test('request without malformed body should throw exception', async () => {
    const r1 = await handler({
      request: {
        body: { function: 'ping', metadata: 'lol' },
        headers: {},
        method: 'post',
        params: {},
        query: {},
        route: '/',
      },
      serverContext: null,
    })
    expect(r1).toEqual({
      body: {
        additionalInfo: {
          expected: 'object or undefined',
          got: 'lol',
          path: '$.metadata',
        },
        reason: 'Error while decoding request',
        success: false,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    })
  })

  test('not 200 responses should throws error (endpoint)', async () => {
    const server = http.createServer({}, async (_, response) => {
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.write(JSON.stringify({ message: 'error' }))
      response.end()
    })
    server.listen(50125)

    const client = build({ endpoint: 'http://localhost:50125', api })

    await expect(client.functions.ping(1)).rejects.toThrow('Unexpected status code: 500. ')

    server.close()
  })

  test('not 200 responses should throws error (handler)', async () => {
    const client = build({
      endpoint: async () => {
        return {
          body: 'error',
          status: 500,
        }
      },
      api,
    })
    await expect(client.functions.ping(1)).rejects.toThrow('Unexpected status code: 500. error')

    const client2 = build({
      endpoint: async () => {
        return {
          body: { message: 'error' },
          status: 500,
        }
      },
      api,
    })
    await expect(client2.functions.ping(1)).rejects.toThrow('Unexpected status code: 500. {"message":"error"}')
  })

  test('invalid response should fail while decoding', async () => {
    const client = build({
      endpoint: async () => {
        return {
          body: {},
          status: 200,
        }
      },
      api,
    })
    await expect(client.functions.ping(1)).rejects.toThrow('Error while decoding response')
  })

  test('getting a failure for a function that does not have errors should throw', async () => {
    const client = build({
      endpoint: async () => {
        return {
          body: { success: true, failure: {} },
          status: 200,
        }
      },
      api,
    })
    await expect(client.functions.ping(1)).rejects.toThrow(
      'Failure should not be present because the function does not declare errors',
    )
  })

  test('additional headers on request should be propagated correctly', async () => {
    const client = build({
      endpoint: async ({ request }) => {
        if (request.headers.additional !== '123') {
          return { body: 'Internal server error', status: 500 }
        } else {
          return { body: { success: true, result: 1 }, status: 200 }
        }
      },
      api,
      fetchOptions: { headers: { additional: '123' } },
    })
    const r1 = await client.functions.ping(1)
    expect(r1).toBe(1)
  })
})

describe('api functions', () => {
  test('define should return api specification', () => {
    const apiSpec = define({
      module: moduleInterface,
      exclusions: {},
    })
    expect(apiSpec.module).toBe(moduleInterface)
    expect(apiSpec.exclusions).toEqual({})
  })

  test('define with exclusions should work', () => {
    const apiSpec = define({
      module: moduleInterface,
      exclusions: { omitted: true },
    })
    expect(apiSpec.exclusions).toEqual({ omitted: true })
  })

  test('define with options should preserve options', () => {
    const apiSpec = define({
      module: moduleInterface,
      exclusions: {},
      options: { path: '/custom-path' },
    })
    expect(apiSpec.options?.path).toBe('/custom-path')
  })

  test('build should return api with module implementation', () => {
    expect(api.module).toBeDefined()
    expect(api.exclusions).toEqual({ omitted: true })
  })

  test('DEFAULT_SERVE_OPTIONS should have correct defaults', () => {
    expect(DEFAULT_SERVE_OPTIONS.introspection).toBe(false)
    expect(DEFAULT_SERVE_OPTIONS.decodeOptions.errorReportingStrategy).toBe('stopAtFirstError')
    expect(DEFAULT_SERVE_OPTIONS.decodeOptions.fieldStrictness).toBe('expectExactFields')
    expect(DEFAULT_SERVE_OPTIONS.decodeOptions.typeCastingStrategy).toBe('expectExactTypes')
  })
})

describe('Response type builder', () => {
  test('Response should create union type for function', () => {
    const functionBody = {
      input: model.number(),
      output: model.string(),
    } as functions.FunctionInterface
    const responseType = Response(functionBody)
    expect(responseType).toBeDefined()
  })

  test('Response should handle function with errors', () => {
    const functionBody = {
      input: model.number(),
      output: model.string(),
      errors: { someError: model.string() },
      retrieve: { select: true },
    } as functions.FunctionInterface
    const responseType = Response(functionBody)
    expect(responseType).toBeDefined()
  })
})

describe('client withMetadata', () => {
  test('withMetadata should create new client with metadata', () => {
    const clientWithoutMeta = build({ endpoint: handler, api })
    const clientWithMeta = clientWithoutMeta.withMetadata({ auth: 'ok' })
    expect(clientWithMeta).toBeDefined()
    expect(clientWithMeta.functions).toBeDefined()
  })

  test('chaining withMetadata should work', async () => {
    const client1 = build({ endpoint: handler, api })
    const client2 = client1.withMetadata({ auth: 'ok' })
    const r1 = await client2.functions.ping(123)
    expect(r1).toBe(123)
  })
})

describe('handler metadata and context', () => {
  test('handler should reject with invalid metadata (auth)', async () => {
    const clientNoAuth = build({ endpoint: handler, api })
    await expect(clientNoAuth.functions.ping(1)).rejects.toThrow('Unauthorized')
  })

  test('handler should accept valid metadata', async () => {
    const clientWithAuth = build({ endpoint: handler, api }).withMetadata({ auth: 'ok' })
    const r1 = await clientWithAuth.functions.ping(123)
    expect(r1).toBe(123)
  })

  test('function-level metadata override should work', async () => {
    const clientNoAuth = build({ endpoint: handler, api })
    const r1 = await clientNoAuth.functions.ping(123, { metadata: { auth: 'ok' } })
    expect(r1).toBe(123)
  })
})

describe('handler error scenarios', () => {
  test('request with invalid function name should return error', async () => {
    const r1 = await handler({
      request: {
        body: { function: 'nonExistent' },
        headers: {},
        method: 'post',
        params: {},
        query: {},
        route: '/',
      },
      serverContext: null,
    })
    expect(r1.body).toEqual({
      additionalInfo: {
        expected: "One of ['ping', 'getUsers', 'divideBy']",
        path: '$.function',
        got: 'nonExistent',
      },
      reason: 'Error while decoding request',
      success: false,
    })
  })

  test('request with non-string function should return error', async () => {
    const r1 = await handler({
      request: {
        body: { function: 123 },
        headers: {},
        method: 'post',
        params: {},
        query: {},
        route: '/',
      },
      serverContext: null,
    })
    expect(r1.body).toEqual({
      additionalInfo: {
        expected: "One of ['ping', 'getUsers', 'divideBy']",
        path: '$.function',
        got: 123,
      },
      reason: 'Error while decoding request',
      success: false,
    })
  })
})

describe('real HTTP endpoint tests', () => {
  test('HTTP server with valid response', async () => {
    const server = http.createServer({}, async (_, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.write(JSON.stringify({ success: true, result: 42 }))
      response.end()
    })
    server.listen(50126)

    const client = build({ endpoint: 'http://localhost:50126', api })
    const r1 = await client.functions.ping(42)
    expect(r1).toBe(42)

    server.close()
  })

  test('HTTP server stringBody error handling', async () => {
    const server = http.createServer({}, async (_, response) => {
      response.writeHead(500, { 'Content-Type': 'application/json' })
      // Write invalid JSON to trigger error in stringBody
      response.write('server error message')
      response.end()
    })
    server.listen(50127)

    const client = build({ endpoint: 'http://localhost:50127', api })
    await expect(client.functions.ping(1)).rejects.toThrow('Unexpected status code: 500. server error message')

    server.close()
  })
})

describe('client with function-level options', () => {
  test('function call with custom headers through fetchOptions', async () => {
    const customHandler = fromModule({
      api,
      async context(context, metadata) {
        return 'ok'
      },
      options: { ...DEFAULT_SERVE_OPTIONS },
    })

    const clientWithHeaders = build({
      endpoint: customHandler,
      api,
      fetchOptions: { headers: { 'X-Custom-Header': 'test-value' } },
    })

    const r1 = await clientWithHeaders.functions.ping(100)
    expect(r1).toBe(100)
  })

  test('function call with undefined header values should be handled', async () => {
    const clientWithUndefinedHeader = build({
      endpoint: handler,
      api,
      fetchOptions: { headers: { 'X-Optional': undefined } },
      metadata: { auth: 'ok' },
    })

    const r1 = await clientWithUndefinedHeader.functions.ping(200)
    expect(r1).toBe(200)
  })
})
