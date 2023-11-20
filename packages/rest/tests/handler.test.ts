import { ErrorHandler, FunctionSpecifications, Request, Response } from '../src/api'
import { fromFunction } from '../src/handler'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'

describe('rest handler', () => {
  const f0 = functions.build({
    input: model.never(),
    output: model.number(),
    async body() {
      return 1
    },
  })
  const f1 = functions.build({
    input: model.string(),
    output: model.number(),
    async body({ input }) {
      return Number(input)
    },
  })
  const f2 = functions.build({
    input: model.object({ a: model.number(), b: model.integer() }),
    output: model.number(),
    async body({ input: { a, b } }) {
      return a * b
    },
  })
  const f3 = functions.build({
    input: model.object({ ping: model.string() }),
    output: model.literal('pong'),
    errors: { notAPing: model.string() },
    async body({ input: { ping } }) {
      if (ping !== 'ping') {
        return result.fail({ notAPing: 'Not a ping!' })
      }
      return result.ok('pong')
    },
  })
  const f4 = functions.build({
    input: model.object({ ping: model.string() }),
    output: model.literal('pong'),
    async body({ input: { ping } }) {
      if (ping !== 'ping') {
        throw new Error('Not a ping!')
      }
      return 'pong' as const
    },
  })
  const user = () => model.entity({ username: model.string(), live: model.boolean(), friend: model.optional(user) })
  const f5 = functions.build({
    input: model.string(),
    output: user,
    retrieve: { select: true },
    async body({ retrieve }) {
      if (retrieve.select?.friend) {
        return { live: true, username: 'name', friend: { live: true, username: 'name2' } }
      }
      return { live: true, username: 'name' }
    },
  })
  const f6 = functions.build({
    input: model.object({ a: model.number(), b: model.object({ a: model.number(), b: model.integer() }) }),
    output: model.number(),
    async body({ input: { a, b } }) {
      return a * b.a * b.b
    },
  })
  const fs = { f0, f1, f2, f3, f4, f5, f6 } as const
  const m = module.build({
    context: async () => ({}),
    functions: fs,
    name: 'example',
    version: '0.0.0',
  })

  function buildHandler(
    f: keyof typeof fs,
    specification: FunctionSpecifications,
    error?: ErrorHandler<functions.Functions, {}>,
  ): (request: Partial<Pick<Request, 'body' | 'query' | 'params' | 'headers'>>) => Promise<Response> {
    const handler = fromFunction({
      functionBody: m.functions[f] as functions.FunctionImplementation,
      functionName: f as string,
      context: async () => ({}),
      specification,
      module: m,
      error,
      api: {},
    })
    return (request) =>
      handler({
        request: {
          body: undefined,
          headers: {},
          params: {},
          query: {},
          ...request,
          method: null as any,
          route: null as any,
        },
        serverContext: {},
      })
  }

  test('works on [never input]', async () => {
    const handler = buildHandler('f0', { method: 'get' })
    const response = await handler({})
    expect(response.status).toBe(200)
    expect(response.body).toBe(1)
  })

  test('works on [scalar input on query]', async () => {
    const handler = buildHandler('f1', { method: 'get' })
    const response = await handler({ query: { input: '123' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(123)
  })

  test('works on [scalar input on path]', async () => {
    const handler = buildHandler('f1', { method: 'get', path: '/f1/{value}' })
    const response = await handler({ params: { value: '123' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(123)
  })

  test('works on [scalar input on body]', async () => {
    const handler = buildHandler('f1', { method: 'post', path: '/f1' })
    const response = await handler({ body: '123' })
    expect(response.status).toBe(200)
    expect(response.body).toBe(123)
  })

  test('works on [scalar input on custom]', async () => {
    const handler = buildHandler('f1', {
      method: 'post',
      path: '/f1',
      openapi: {
        specification: {},
        input: (request) => request.headers.value,
        request: () => ({}),
      },
    })
    const response = await handler({ headers: { value: '123' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(123)
  })

  test('dont works on [scalar input on query]', async () => {
    const handler = buildHandler('f1', { method: 'get' })
    const response = await handler({})
    expect(response.status).toBe(400)
    expect(response.body).toStrictEqual({
      errors: [
        {
          expected: 'string',
          got: undefined,
          path: '$',
        },
      ],
      message: 'Invalid input',
    })
  })

  test('works on [object input on query]', async () => {
    const handler = buildHandler('f2', { method: 'get', path: '/f2' })
    const response = await handler({ query: { a: '1.1', b: '2' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(2.2)
  })

  test('works on [object input on partially query and partially params]', async () => {
    const handler = buildHandler('f2', { method: 'get', path: '/f2/{a}' })
    const response = await handler({ query: { b: '2' }, params: { a: '1.1' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(2.2)
  })

  test('works on [object input on params]', async () => {
    const handler = buildHandler('f2', { method: 'get', path: '/f2/{b}/{a}' })
    const response = await handler({ params: { a: '1.1', b: '2' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(2.2)
  })

  test('works on [object input on body]', async () => {
    const handler = buildHandler('f2', { method: 'post', path: '/f2' })
    const response = await handler({ body: { a: '1.1', b: 2 } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(2.2)
  })

  test('works on [object input partially on body and partially on params]', async () => {
    const handler = buildHandler('f2', { method: 'post', path: '/f2/{b}' })
    const response = await handler({ body: { a: 1.1, b: '2' }, params: { b: '2' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(2.2)
  })

  test('dont works on [object input on body]', async () => {
    const handler = buildHandler('f2', { method: 'post', path: '/f2' })
    const response = await handler({ body: { a: {}, b: 1 } })
    expect(response.status).toBe(400)
    expect(response.body).toStrictEqual({
      errors: [{ expected: 'number', got: {}, path: '$.a' }],
      message: 'Invalid input',
    })
  })

  test('works on [object input spread on param]', async () => {
    const handler = buildHandler('f3', { method: 'get', path: '/f3/{ping}' })
    const response = await handler({ params: { ping: 'ping' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe('pong')
  })

  test('dont works on [object input spread on param]', async () => {
    const handler = buildHandler('f3', { method: 'post', path: '/f3/{ping}', errorCodes: { notAPing: 401 } })
    const response = await handler({ params: { ping: 'lol' } })
    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual({ notAPing: 'Not a ping!' })
  })

  test('works on [object input on query]', async () => {
    const handler = buildHandler('f3', { method: 'get', path: '/f3' })
    const response = await handler({ query: { ping: 'ping' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe('pong')
  })

  test('dont works on [object input spread on param 2]', async () => {
    const handler = buildHandler('f4', { method: 'post', path: '/f4/{ping}' }, async ({ error }) => {
      if (error instanceof Error) {
        return { body: error.message, status: 500 }
      }
    })
    const response = await handler({ params: { ping: 'lol' } })
    expect(response.status).toBe(500)
    expect(response.body).toStrictEqual('Not a ping!')
  })

  test('dont works on [fail to extract input]', async () => {
    const handler = buildHandler('f4', {
      method: 'post',
      path: '/f4/{ping}',
      openapi: {
        specification: {},
        input(request) {
          throw new Error('Fail')
        },
        request: () => ({}),
      },
    })
    const response = await handler({ headers: { ping: 'ping' } })
    expect(response.status).toBe(500)
    expect(response.body).toStrictEqual('Error while extracting input from request')
  })

  test('works on [output with retrieve]', async () => {
    const handler = buildHandler('f5', { method: 'get', path: '/f5' })
    const response = await handler({ query: { input: '' } })
    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ live: true, username: 'name' })

    const response2 = await handler({
      query: { input: '' },
      headers: { retrieve: JSON.stringify({ select: { friend: true } }) },
    })
    expect(response2.status).toBe(200)
    expect(response2.body).toStrictEqual({ live: true, username: 'name', friend: { live: true, username: 'name2' } })
  })

  test('dont works on [output with retrieve]', async () => {
    const handler = buildHandler('f5', { method: 'get', path: '/f5' })
    const response = await handler({ query: { input: '' }, headers: { retrieve: '{ hello world }' } })

    expect(response.status).toBe(500)
    expect(response.body).toStrictEqual('Invalid JSON on "retrieve" header')

    const response2 = await handler({
      query: { input: '' },
      headers: { retrieve: JSON.stringify({ select: { friends: true } }) },
    })
    expect(response2.status).toBe(400)
    expect(response2.body).toStrictEqual({
      errors: [{ expected: 'undefined', got: true, path: '$.select.friends' }],
      message: 'Invalid retrieve',
    })
  })
  test('works on [complex object input on query]', async () => {
    const handler = buildHandler('f6', { method: 'get', path: '/f6' })
    const response = await handler({ query: { a: '1', 'b[a]': '2', 'b[b]': '3' } })
    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual(6)
  })
})
