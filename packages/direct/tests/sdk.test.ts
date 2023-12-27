import { fromModule } from '../src/handler'
import { build } from '../src/sdk'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import http from 'node:http'
import { expect, test, describe } from 'vitest'

const ping = functions.build({
  input: model.number(),
  output: model.number(),
  async body(args) {
    if (args.input < 0 && !Number.isInteger(args.input)) {
      throw 'Not integer ping'
    }
    if (args.input < 0) {
      throw new Error('Negative ping')
    }
    return args.input
  },
})

const divideBy = functions.build({
  input: model.object({ dividend: model.number(), divisor: model.number() }),
  output: model.number(),
  errors: { dividingByZero: model.string() },
  async body({ input: { dividend, divisor } }) {
    if (divisor === 0) {
      return result.fail({ dividingByZero: 'divisor is 0' })
    }
    return result.ok(dividend / divisor)
  },
})

const getUsers = functions.build({
  input: model.never(),
  output: model.entity({ name: model.string() }).array(),
  retrieve: { select: true },
  async body() {
    return [{ name: 'John' }]
  },
})

const m = module.build({
  name: 'test',
  version: '0.0.1',
  async context() {
    return {}
  },
  functions: { ping, getUsers, divideBy },
})

const handler = fromModule({
  module: m,
  async context(metadata, request) {
    if (metadata?.auth !== 'ok') {
      throw new Error('Unauthorized')
    }
    return {}
  },
})
const client = build({ endpoint: handler, module: m }).withMetadata({ auth: 'ok' })

describe('direct sdk', () => {
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
    await expect(() => client.functions.ping('abc' as any)).rejects.toThrow('Error while decoding request')
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
})

describe('edge cases', () => {
  test('module without functions should throw exception', async () => {
    const r1 = await fromModule({
      module: module.build({
        async context(input, args) {
          return {}
        },
        functions: {},
        name: '',
        version: '0.0.1',
      }),
      async context(metadata, request) {
        return {}
      },
    })({ body: {}, headers: {}, method: 'post', params: {}, query: {}, route: '/' })
    expect(r1).toEqual({
      body: {
        additionalInfo: 'This module does not expose any function',
        reason: 'No function available',
        success: false,
      },
      status: 200,
    })
  })

  test('request without function name should throw exception', async () => {
    const r1 = await handler({ body: {}, headers: {}, method: 'post', params: {}, query: {}, route: '/' })
    expect(r1).toEqual({
      body: {
        additionalInfo: {
          expected: "One of ['ping', 'getUsers', 'divideBy']",
          got: null,
          path: '$.functionName',
        },
        reason: 'Error while decoding request',
        success: false,
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

    const client = build({ endpoint: 'http://localhost:50125', module: m })

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
      module: m,
    })
    await expect(client.functions.ping(1)).rejects.toThrow('Unexpected status code: 500. error')

    const client2 = build({
      endpoint: async () => {
        return {
          body: { message: 'error' },
          status: 500,
        }
      },
      module: m,
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
      module: m,
    })
    await expect(client.functions.ping(1)).rejects.toThrow('Error while decoding response')
  })

  test('getting a failure for a function that does not have errors should throw', async () => {
    const client = build({
      endpoint: async () => {
        return {
          body: { success: true, operationId: '123', result: { isOk: false, errors: {} } },
          status: 200,
        }
      },
      module: m,
    })
    await expect(client.functions.ping(1)).rejects.toThrow(
      'Failure should not be present because the function does not declare errors',
    )
  })
})
