import { ErrorHandler, FunctionSpecifications, build, define } from '../src/api'
import { fromFunction } from '../src/handler'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { http } from '@mondrian-framework/utils'
import { describe, expect, test } from 'vitest'

type Request = http.Request
type Response = http.Response

describe('api', () => {
  const testModule = module.define({
    name: 'test',
    functions: {
      testFn: functions.define({
        input: model.string(),
        output: model.string(),
      }),
    },
  })

  describe('build', () => {
    test('creates an API with module implementation', () => {
      const impl = module.build({
        ...testModule,
        functions: {
          testFn: functions.define({ input: model.string(), output: model.string() }).implement({
            async body({ input }) {
              return result.ok(input)
            },
          }),
        },
      })
      const api = build({
        version: 1,
        module: impl,
        functions: { testFn: { method: 'get' } },
      })
      expect(api.version).toBe(1)
      expect(api.module).toBe(impl)
    })
  })

  describe('define', () => {
    test('creates an API specification', () => {
      const api = define({
        version: 1,
        module: testModule,
        functions: { testFn: { method: 'get' } },
      })
      expect(api.version).toBe(1)
      expect(api.module).toBe(testModule)
    })

    test('validates api version', () => {
      expect(() =>
        define({
          version: 1.5,
          module: testModule,
          functions: {},
        }),
      ).toThrow('Invalid api version')
    })
  })
})

describe('rest handler', () => {
  const f0 = functions
    .define({
      output: model.number(),
    })
    .implement({
      async body() {
        return result.ok(1)
      },
    })
  const f1 = functions
    .define({
      input: model.string(),
      output: model.number(),
    })
    .implement({
      async body({ input }) {
        return result.ok(Number(input))
      },
    })
  const f2 = functions
    .define({
      input: model.object({ a: model.number(), b: model.integer() }),
      output: model.number(),
    })
    .implement({
      async body({ input: { a, b } }) {
        return result.ok(a * b)
      },
    })
  const f3 = functions
    .define({
      input: model.object({ ping: model.string() }),
      output: model.literal('pong'),
      errors: { notAPing: model.string() },
    })
    .implement({
      async body({ input: { ping } }) {
        if (ping !== 'ping') {
          return result.fail({ notAPing: 'Not a ping!' })
        }
        return result.ok('pong')
      },
    })
  const f4 = functions
    .define({
      input: model.object({ ping: model.string() }),
      output: model.literal('pong'),
    })
    .implement({
      async body({ input: { ping } }) {
        if (ping !== 'ping') {
          throw new Error('Not a ping!')
        }
        return result.ok('pong')
      },
    })
  const user = () => model.entity({ username: model.string(), live: model.boolean(), friend: model.optional(user) })
  const f5 = functions
    .define({
      input: model.string(),
      output: user,
      retrieve: { select: true },
    })
    .implement({
      async body({ retrieve }) {
        if (retrieve.select?.friend) {
          return result.ok({ live: true, username: 'name', friend: { live: true, username: 'name2' } })
        }
        return result.ok({ live: true, username: 'name' })
      },
    })
  const f6 = functions
    .define({
      input: model.object({ a: model.number(), b: model.object({ a: model.number(), b: model.integer() }) }),
      output: model.number(),
    })
    .implement({
      async body({ input: { a, b } }) {
        return result.ok(a * b.a * b.b)
      },
    })
  const f7 = functions
    .define({
      input: model.string(),
      output: model.array(model.string()),
    })
    .implement({
      async body() {
        return result.ok(['a', 'b', 'c'])
      },
    })
  const f8 = functions
    .define({
      input: model.string(),
      output: model.string(),
    })
    .implement({
      async body() {
        throw 'string error'
      },
    })
  const f9 = functions
    .define({
      input: model.object({ data: model.string() }),
      output: model.string(),
      errors: { badRequest: model.string(), unauthorized: model.string() },
    })
    .implement({
      async body({ input }) {
        if (input.data === 'bad') {
          return result.fail({ badRequest: 'Bad request' })
        }
        if (input.data === 'unauth') {
          return result.fail({ unauthorized: 'Unauthorized' })
        }
        return result.ok(input.data)
      },
    })
  const fs = { f0, f1, f2, f3, f4, f5, f6, f7, f8, f9 } as const
  const m = module.build({
    functions: fs,
    name: 'example',
  })

  function buildHandler(
    f: keyof typeof fs,
    specification: FunctionSpecifications,
    onError?: ErrorHandler<functions.Functions, {}>,
    apiOptions?: { errorCodes?: Record<string, number> },
  ): (request: Partial<Pick<Request, 'body' | 'query' | 'params' | 'headers'>>) => Promise<Response> {
    const handler = fromFunction({
      functionBody: m.functions[f] as functions.FunctionImplementation,
      functionName: f as string,
      context: async () => ({}),
      specification,
      module: m,
      onError,
      api: { errorCodes: apiOptions?.errorCodes },
    })
    return (request) =>
      handler({
        request: {
          body: undefined,
          headers: {},
          params: {},
          query: {},
          ...request,
          method: specification.method ?? 'get',
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
      from: 'input',
      message: 'Invalid input.',
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
      from: 'input',
      message: 'Invalid input.',
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
    })
    const response = await handler({ headers: { ping: 'ping' } })
    expect(response.status).toBe(400)
  })

  test('works on [output with retrieve]', async () => {
    const handler = buildHandler('f5', { method: 'get', path: '/f5' })
    const response = await handler({ query: { input: '' } })
    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ username: 'name', live: true })

    const response2 = await handler({
      query: { input: '', 'select[friend][select][username]': 'true' },
    })
    expect(response2.status).toBe(200)
    expect(response2.body).toStrictEqual({ username: 'name', live: true, friend: { username: 'name2', live: true } })
  })

  test('dont works on [output with retrieve]', async () => {
    const handler = buildHandler('f5', { method: 'get', path: '/f5' })

    const response = await handler({
      query: { input: '', 'select[friends]': 'true' },
    })
    expect(response.status).toBe(400)
    expect(response.body).toStrictEqual({
      errors: [{ expected: 'undefined', got: 'true', path: '$.select.friends' }],
      from: 'retrieve',
      message: 'Invalid input.',
    })
  })
  test('works on [complex object input on query]', async () => {
    const handler = buildHandler('f6', { method: 'get', path: '/f6' })
    const response = await handler({ query: { a: '1', 'b[a]': '2', 'b[b]': '3' } })
    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual(6)
  })

  test('returns array output correctly', async () => {
    const handler = buildHandler('f7', { method: 'get' })
    const response = await handler({ query: { input: 'test' } })
    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual(['a', 'b', 'c'])
  })

  test('handles non-Error thrown values', async () => {
    const handler = buildHandler('f8', { method: 'get' })
    const response = await handler({ query: { input: 'test' } })
    expect(response.status).toBe(500)
    expect(response.body).toBe('Internal server error')
  })

  test('uses api-level error codes', async () => {
    const handler = buildHandler('f9', { method: 'post' }, undefined, { errorCodes: { unauthorized: 401 } })
    const response = await handler({ body: { data: 'unauth' } })
    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual({ unauthorized: 'Unauthorized' })
  })

  test('uses specification-level error codes over api-level', async () => {
    const handler = buildHandler('f9', { method: 'post', errorCodes: { badRequest: 422 } }, undefined, {
      errorCodes: { badRequest: 400 },
    })
    const response = await handler({ body: { data: 'bad' } })
    expect(response.status).toBe(422)
    expect(response.body).toStrictEqual({ badRequest: 'Bad request' })
  })

  test('onError handler can return undefined to use default', async () => {
    const handler = buildHandler('f4', { method: 'post', path: '/f4/{ping}' }, async () => undefined)
    const response = await handler({ params: { ping: 'lol' } })
    expect(response.status).toBe(500)
    expect(response.body).toBe('Not a ping!')
  })

  test('content-type header is set based on specification', async () => {
    const handler = buildHandler('f0', { method: 'get', contentType: 'text/plain' })
    const response = await handler({})
    expect(response.headers!['Content-Type']).toBe('text/plain')
  })

  test('handles decoding options from specification', async () => {
    const handler = buildHandler('f1', {
      method: 'get',
      decodingOptions: { fieldStrictness: 'allowAdditionalFields' },
    })
    const response = await handler({ query: { input: '123' } })
    expect(response.status).toBe(200)
    expect(response.body).toBe(123)
  })

  test('returns x-total-count header with TotalCountArray', async () => {
    const fTotalCount = functions
      .define({
        output: model.array(model.string(), { totalCount: true }),
      })
      .implement({
        async body() {
          const arr = new model.TotalCountArray(100, ['a', 'b', 'c'])
          return result.ok(arr)
        },
      })
    const mTotalCount = module.build({
      functions: { fTotalCount },
      name: 'totalCountExample',
    })
    const handlerTotalCount = fromFunction({
      functionBody: mTotalCount.functions.fTotalCount as any,
      functionName: 'fTotalCount',
      context: async () => ({}),
      specification: { method: 'get' },
      module: mTotalCount,
      api: {},
    })
    const response = await handlerTotalCount({
      request: {
        body: undefined,
        headers: {},
        params: {},
        query: {},
        method: 'get',
        route: null as any,
      },
      serverContext: {},
    })
    expect(response.status).toBe(200)
    expect(response.headers!['x-total-count']).toBe('100')
    // Response body is a TotalCountArray, so check elements match
    expect(Array.from(response.body as unknown[])).toStrictEqual(['a', 'b', 'c'])
  })

  test('returns x-total-count header with regular array (uses length)', async () => {
    const fRegularArray = functions
      .define({
        output: model.array(model.string(), { totalCount: true }),
      })
      .implement({
        async body() {
          return result.ok(['a', 'b', 'c'] as any)
        },
      })
    const mRegularArray = module.build({
      functions: { fRegularArray },
      name: 'regularArrayExample',
    })
    const handlerRegularArray = fromFunction({
      functionBody: mRegularArray.functions.fRegularArray as any,
      functionName: 'fRegularArray',
      context: async () => ({}),
      specification: { method: 'get' },
      module: mRegularArray,
      api: {},
    })
    const response = await handlerRegularArray({
      request: {
        body: undefined,
        headers: {},
        params: {},
        query: {},
        method: 'get',
        route: null as any,
      },
      serverContext: {},
    })
    expect(response.status).toBe(200)
    expect(response.headers!['x-total-count']).toBe('3')
  })
})
