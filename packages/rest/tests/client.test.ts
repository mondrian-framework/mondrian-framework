import { rest } from '../src'
import { build as buildClient, withHeaders } from '../src/client'
import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

describe('REST client', () => {
  const echoFn = functions.define({
    input: model.string(),
    output: model.string(),
  })

  const noInputFn = functions.define({
    output: model.number(),
  })

  const errorFn = functions.define({
    input: model.string(),
    output: model.string(),
    errors: { badRequest: model.string(), notFound: model.string() },
  })

  const userType = () =>
    model.entity({
      id: model.string(),
      name: model.string(),
      email: model.optional(model.string()),
    })

  const retrieveFn = functions.define({
    input: model.string(),
    output: userType,
    retrieve: { select: true },
  })

  const testModule = module.define({
    name: 'testModule',
    functions: {
      echo: echoFn,
      noInput: noInputFn,
      errorFn: errorFn,
      retrieve: retrieveFn,
    },
  })

  const api = rest.define({
    version: 1,
    module: testModule,
    functions: {
      echo: { method: 'post' },
      noInput: { method: 'get' },
      errorFn: { method: 'post' },
      retrieve: { method: 'get' },
    },
  })

  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('buildClient', () => {
    test('creates a client with functions', () => {
      global.fetch = vi.fn()
      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      expect(client.functions).toBeDefined()
      expect(typeof client.functions.echo).toBe('function')
      expect(typeof client.functions.noInput).toBe('function')
      expect(typeof client.withHeaders).toBe('function')
    })

    test('creates a client with custom headers', () => {
      global.fetch = vi.fn()
      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
        headers: { Authorization: 'Bearer token' },
      })

      expect(client.functions).toBeDefined()
    })

    test('handles endpoint with trailing slash', () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"result"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000/',
        rest: api,
      })

      expect(client.functions).toBeDefined()
    })
  })

  describe('withHeaders', () => {
    test('creates a client builder with headers', () => {
      global.fetch = vi.fn()
      const client = withHeaders({ Authorization: 'Bearer token' }).build({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      expect(client.functions).toBeDefined()
    })

    test('withHeaders on client returns new client with combined headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"result"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
        headers: { 'X-Custom': 'value' },
      })

      const newClient = client.withHeaders({ Authorization: 'Bearer token' })
      expect(newClient.functions).toBeDefined()
      expect(newClient).not.toBe(client)
    })
  })

  describe('function calls', () => {
    test('calls function with input', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"hello world"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      const result = await client.functions.echo('hello')
      expect(result).toBe('hello world')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/echo',
        expect.objectContaining({
          method: 'post',
          body: '"hello"',
        }),
      )
    })

    test('calls function without input', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '42',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      const result = await client.functions.noInput()
      expect(result).toBe(42)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/noInput',
        expect.objectContaining({
          method: 'get',
        }),
      )
    })

    test('handles function with errors returning success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"success"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      const res = await client.functions.errorFn('input')
      expect(res.isOk).toBe(true)
      if (res.isOk) {
        expect(res.value).toBe('success')
      }
    })

    test('handles function errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '{"badRequest": "Invalid input"}',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      const res = await client.functions.errorFn('input')
      expect(res.isOk).toBe(false)
      if (!res.isOk) {
        expect(res.error).toEqual({ badRequest: 'Invalid input' })
      }
    })

    test('throws on unknown error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => 'Server error',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      await expect(client.functions.errorFn('input')).rejects.toThrow('Error calling function errorFn')
    })

    test('throws on invalid output', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '123', // should be string
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      await expect(client.functions.echo('hello')).rejects.toThrow('Invalid output for function echo')
    })

    test('throws on invalid error output when error key does not match', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '{"unknownError": "some error"}', // key doesn't match defined errors
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      await expect(client.functions.errorFn('input')).rejects.toThrow('Error calling function errorFn')
    })
  })

  describe('retrieve options', () => {
    test('sends retrieve options in query string', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '{"id": "1", "name": "test"}',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      await client.functions.retrieve('1', {
        retrieve: {
          select: { id: true, name: true },
        },
      })

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('select'), expect.anything())
    })

    test('handles retrieve with skip and take', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '{"id": "1", "name": "test"}',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      await client.functions.retrieve('1', {
        retrieve: {
          select: { id: true },
          skip: 5,
          take: 10,
        },
      })

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('take=10'), expect.anything())
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('skip=5'), expect.anything())
    })
  })

  describe('function not exposed', () => {
    test('throws when function is not exposed', async () => {
      const partialApi = rest.define({
        version: 1,
        module: testModule,
        functions: {
          // echo not exposed
        },
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: partialApi,
      })

      await expect(client.functions.echo('hello')).rejects.toThrow(
        'The function echo is not exposed through the REST API',
      )
    })
  })

  describe('version handling', () => {
    test('uses max version from specification', async () => {
      const versionedApi = rest.define({
        version: 3,
        module: testModule,
        functions: {
          echo: { method: 'post', version: { min: 1, max: 2 } },
        },
      })

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"result"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: versionedApi,
      })

      await client.functions.echo('hello')
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/v2/echo', expect.anything())
    })

    test('uses min version if only min is specified', async () => {
      const versionedApi = rest.define({
        version: 3,
        module: testModule,
        functions: {
          echo: { method: 'post', version: { min: 2 } },
        },
      })

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"result"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: versionedApi,
      })

      await client.functions.echo('hello')
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/v2/echo', expect.anything())
    })
  })

  describe('content type handling', () => {
    test('handles non-JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        text: async () => 'plain text result',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: api,
      })

      const result = await client.functions.echo('hello')
      expect(result).toBe('plain text result')
    })
  })

  describe('array specifications', () => {
    test('uses last specification in array', async () => {
      const arrayApi = rest.define({
        version: 2,
        module: testModule,
        functions: {
          echo: [
            { method: 'get', version: { max: 1 } },
            { method: 'post', version: { min: 2 } },
          ],
        },
      })

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"result"',
      })

      const client = buildClient({
        endpoint: 'http://localhost:3000',
        rest: arrayApi,
      })

      await client.functions.echo('hello')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v2/echo',
        expect.objectContaining({ method: 'post' }),
      )
    })
  })
})
