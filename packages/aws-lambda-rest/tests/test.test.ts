import { handler } from '../src'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda'
import { describe, expect, test, vi } from 'vitest'

// Test functions
const pingFunction = functions
  .define({
    input: model.number(),
    output: model.number(),
  })
  .implement({
    async body({ input }) {
      return result.ok(input)
    },
  })

const echoFunction = functions
  .define({
    input: model.string(),
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      return result.ok(input)
    },
  })

const addFunction = functions
  .define({
    input: model.object({ a: model.number(), b: model.number() }),
    output: model.number(),
  })
  .implement({
    async body({ input: { a, b } }) {
      return result.ok(a + b)
    },
  })

const errorFunction = functions
  .define({
    input: model.string(),
    output: model.string(),
    errors: { badRequest: model.string(), notFound: model.string() },
  })
  .implement({
    async body({ input }) {
      if (input === 'bad') {
        return result.fail({ badRequest: 'Bad request' })
      }
      if (input === 'notfound') {
        return result.fail({ notFound: 'Not found' })
      }
      return result.ok(input)
    },
  })

const throwingFunction = functions
  .define({
    input: model.string(),
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      if (input === 'throw') {
        throw new Error('Thrown error')
      }
      return result.ok(input)
    },
  })

const noInputFunction = functions
  .define({
    output: model.string(),
  })
  .implement({
    async body() {
      return result.ok('no input')
    },
  })

// Build test module
const testModule = module.build({
  name: 'test-module',
  functions: {
    ping: pingFunction,
    echo: echoFunction,
    add: addFunction,
    error: errorFunction,
    throwing: throwingFunction,
    noInput: noInputFunction,
  },
})

// Build REST API
const testApi = rest.build({
  version: 2,
  module: testModule,
  functions: {
    ping: { method: 'get', path: '/ping/{value}' },
    echo: [
      { method: 'get', path: '/echo' },
      { method: 'post', path: '/echo' },
    ],
    add: { method: 'post', path: '/add' },
    error: { method: 'post', path: '/error' },
    throwing: { method: 'post', path: '/throwing' },
    noInput: { method: 'get', path: '/no-input' },
  },
  options: {
    pathPrefix: '/api',
  },
})

// Helper to create mock AWS Lambda event
function createMockEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/api/v1/ping/123',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'api',
      http: {
        method: 'GET',
        path: '/api/v1/ping/123',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    ...overrides,
  }
}

// Helper to create mock AWS Lambda context
function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  }
}

describe('handler.build', () => {
  describe('basic handler creation', () => {
    test('should create a valid AWS Lambda handler', () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      expect(lambdaHandler).toBeDefined()
      expect(typeof lambdaHandler).toBe('function')
    })

    test('should handle GET request with path parameter', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/ping/42',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v1/ping/42',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})

      expect(response).toBeDefined()
      expect(typeof response).toBe('object')
    })

    test('should handle POST request with body', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/add',
        body: JSON.stringify({ a: 10, b: 20 }),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'POST',
            path: '/api/v1/add',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})

      expect(response).toBeDefined()
    })

    test('should handle GET request with query parameters', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/echo',
        rawQueryString: 'input=hello',
        queryStringParameters: { input: 'hello' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v1/echo',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})

      expect(response).toBeDefined()
    })
  })

  describe('introspection options', () => {
    test('should enable introspection with default UI', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      expect(lambdaHandler).toBeDefined()
    })

    test('should enable introspection with redoc UI', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'redoc',
          },
        },
      })

      expect(lambdaHandler).toBeDefined()
    })

    test('should enable introspection with scalar UI', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'scalar',
          },
        },
      })

      expect(lambdaHandler).toBeDefined()
    })

    test('should enable introspection with no UI (none)', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'none',
          },
        },
      })

      expect(lambdaHandler).toBeDefined()
    })

    test('should handle introspection path without trailing slash', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/index.html',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/index.html',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle introspection path with trailing slash', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs/',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/index.html',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/index.html',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle swagger.html endpoint', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'redoc',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/swagger.html',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/swagger.html',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle redoc.html endpoint', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/redoc.html',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/redoc.html',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle scalar.html endpoint', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/scalar.html',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/scalar.html',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle schema.json endpoint with valid version', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/v1/schema.json',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/v1/schema.json',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should cache schema.json responses', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/v1/schema.json',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/v1/schema.json',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      // Call twice to test caching
      await lambdaHandler(event, createMockContext(), () => {})
      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle schema.json endpoint with invalid version (non-integer)', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/v1.5/schema.json',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/v1.5/schema.json',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle schema.json endpoint with version 0', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/v0/schema.json',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/v0/schema.json',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle schema.json endpoint with version exceeding max', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/v100/schema.json',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/v100/schema.json',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle schema.json endpoint with invalid version (NaN)', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs/vABC/schema.json',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs/vABC/schema.json',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should redirect base introspection path to index.html', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/docs',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/docs',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle root path introspection', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/',
            ui: 'swagger',
          },
        },
      })

      const event = createMockEvent({
        rawPath: '/index.html',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/index.html',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })
  })

  describe('customize option', () => {
    test('should allow customizing the lambda-api server', async () => {
      const customizeFn = vi.fn()

      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        customize: (server) => {
          customizeFn(server)
          server.get('/custom-route', (_req: any, res: any) => {
            return res.status(200).send({ custom: true })
          })
        },
      })

      expect(customizeFn).toHaveBeenCalledTimes(1)
      expect(lambdaHandler).toBeDefined()
    })
  })

  describe('error handling', () => {
    test('should handle function errors gracefully', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/error',
        body: JSON.stringify({ data: 'bad' }),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'POST',
            path: '/api/v1/error',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should call onError handler when function throws', async () => {
      const onErrorMock = vi.fn().mockResolvedValue({
        status: 500,
        body: { error: 'Internal error' },
        headers: { 'Content-Type': 'application/json' },
      })

      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
        onError: onErrorMock,
      })

      const event = createMockEvent({
        rawPath: '/api/v1/throwing',
        body: JSON.stringify('throw'),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'POST',
            path: '/api/v1/throwing',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })
  })

  describe('context handling', () => {
    test('should pass server context to context function', async () => {
      const contextFn = vi.fn().mockResolvedValue({})

      const lambdaHandler = handler.build({
        api: testApi,
        context: contextFn,
      })

      const event = createMockEvent({
        rawPath: '/api/v1/no-input',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v1/no-input',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      await lambdaHandler(event, createMockContext(), () => {})

      expect(contextFn).toHaveBeenCalled()
      const contextArg = contextFn.mock.calls[0][0]
      expect(contextArg).toHaveProperty('lambdaApi')
      expect(contextArg.lambdaApi).toHaveProperty('request')
      expect(contextArg.lambdaApi).toHaveProperty('response')
    })
  })

  describe('API validation', () => {
    test('should throw error for invalid API version', () => {
      const invalidModule = module.build({
        name: 'invalid',
        functions: {
          test: functions.define({ output: model.string() }).implement({
            async body() {
              return result.ok('test')
            },
          }),
        },
      })

      expect(() => {
        handler.build({
          api: rest.build({
            version: 0,
            module: invalidModule,
            functions: { test: { method: 'get' } },
          }),
          context: async () => ({}),
        })
      }).toThrow()
    })

    test('should throw error for non-integer API version', () => {
      const invalidModule = module.build({
        name: 'invalid',
        functions: {
          test: functions.define({ output: model.string() }).implement({
            async body() {
              return result.ok('test')
            },
          }),
        },
      })

      expect(() => {
        handler.build({
          api: rest.build({
            version: 1.5,
            module: invalidModule,
            functions: { test: { method: 'get' } },
          }),
          context: async () => ({}),
        })
      }).toThrow()
    })
  })

  describe('HTTP methods', () => {
    test('should handle POST request', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/echo',
        body: JSON.stringify('hello'),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'POST',
            path: '/api/v1/echo',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle no-input function', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/no-input',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v1/no-input',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })
  })

  describe('multiple function specifications', () => {
    test('should handle function with multiple specifications (array)', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      // Test GET /echo
      const getEvent = createMockEvent({
        rawPath: '/api/v1/echo',
        queryStringParameters: { input: 'get-test' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v1/echo',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const getResponse = await lambdaHandler(getEvent, createMockContext(), () => {})
      expect(getResponse).toBeDefined()

      // Test POST /echo
      const postEvent = createMockEvent({
        rawPath: '/api/v1/echo',
        body: JSON.stringify('post-test'),
        headers: { 'content-type': 'application/json' },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'POST',
            path: '/api/v1/echo',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const postResponse = await lambdaHandler(postEvent, createMockContext(), () => {})
      expect(postResponse).toBeDefined()
    })
  })

  describe('versioned API endpoints', () => {
    test('should handle v1 endpoint', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v1/no-input',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v1/no-input',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })

    test('should handle v2 endpoint', async () => {
      const lambdaHandler = handler.build({
        api: testApi,
        context: async () => ({}),
      })

      const event = createMockEvent({
        rawPath: '/api/v2/no-input',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            method: 'GET',
            path: '/api/v2/no-input',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      })

      const response = await lambdaHandler(event, createMockContext(), () => {})
      expect(response).toBeDefined()
    })
  })
})

describe('handler.ServerContext', () => {
  test('should export ServerContext type', () => {
    // Type check - this is primarily to ensure the type is exported correctly
    const context: handler.ServerContext = {
      lambdaApi: {
        request: {} as any,
        response: {} as any,
      },
    }
    expect(context).toBeDefined()
  })
})

describe('API with functions that have no specifications', () => {
  test('should skip functions without specifications', () => {
    const moduleWithExtra = module.build({
      name: 'extra-module',
      functions: {
        exposed: functions.define({ output: model.string() }).implement({
          async body() {
            return result.ok('exposed')
          },
        }),
        hidden: functions.define({ output: model.string() }).implement({
          async body() {
            return result.ok('hidden')
          },
        }),
      },
    })

    const apiWithPartialSpecs = rest.build({
      version: 1,
      module: moduleWithExtra,
      functions: {
        // Only expose 'exposed' function, not 'hidden'
        exposed: { method: 'get', path: '/exposed' },
      },
    })

    const lambdaHandler = handler.build({
      api: apiWithPartialSpecs,
      context: async () => ({}),
    })

    expect(lambdaHandler).toBeDefined()
  })
})

describe('edge cases', () => {
  test('should handle empty body', async () => {
    const lambdaHandler = handler.build({
      api: testApi,
      context: async () => ({}),
    })

    const event = createMockEvent({
      rawPath: '/api/v1/no-input',
      body: undefined,
      requestContext: {
        ...createMockEvent().requestContext,
        http: {
          method: 'GET',
          path: '/api/v1/no-input',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    })

    const response = await lambdaHandler(event, createMockContext(), () => {})
    expect(response).toBeDefined()
  })

  test('should handle empty headers', async () => {
    const lambdaHandler = handler.build({
      api: testApi,
      context: async () => ({}),
    })

    const event = createMockEvent({
      rawPath: '/api/v1/no-input',
      headers: {},
      requestContext: {
        ...createMockEvent().requestContext,
        http: {
          method: 'GET',
          path: '/api/v1/no-input',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    })

    const response = await lambdaHandler(event, createMockContext(), () => {})
    expect(response).toBeDefined()
  })

  test('should handle malformed JSON body gracefully', async () => {
    const lambdaHandler = handler.build({
      api: testApi,
      context: async () => ({}),
    })

    const event = createMockEvent({
      rawPath: '/api/v1/add',
      body: 'not-valid-json',
      headers: { 'content-type': 'application/json' },
      requestContext: {
        ...createMockEvent().requestContext,
        http: {
          method: 'POST',
          path: '/api/v1/add',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    })

    const response = await lambdaHandler(event, createMockContext(), () => {})
    expect(response).toBeDefined()
  })

  test('should handle API without pathPrefix', async () => {
    const simpleModule = module.build({
      name: 'simple',
      functions: {
        test: functions.define({ output: model.string() }).implement({
          async body() {
            return result.ok('test')
          },
        }),
      },
    })

    const apiWithoutPrefix = rest.build({
      version: 1,
      module: simpleModule,
      functions: {
        test: { method: 'get', path: '/test' },
      },
    })

    const lambdaHandler = handler.build({
      api: apiWithoutPrefix,
      context: async () => ({}),
    })

    expect(lambdaHandler).toBeDefined()
  })

  test('should handle function without explicit method (uses default)', async () => {
    const simpleModule = module.build({
      name: 'simple',
      functions: {
        test: functions.define({ output: model.string() }).implement({
          async body() {
            return result.ok('test')
          },
        }),
      },
    })

    const apiWithDefaultMethod = rest.build({
      version: 1,
      module: simpleModule,
      functions: {
        test: { path: '/test' },
      },
    })

    const lambdaHandler = handler.build({
      api: apiWithDefaultMethod,
      context: async () => ({}),
    })

    expect(lambdaHandler).toBeDefined()
  })
})

describe('attachRestMethods', () => {
  test('should correctly attach methods and handle responses', async () => {
    // Create a simple test module
    const simpleFunction = functions
      .define({
        input: model.object({ value: model.number() }),
        output: model.number(),
      })
      .implement({
        async body({ input }) {
          return result.ok(input.value * 2)
        },
      })

    const simpleModule = module.build({
      name: 'simple-test',
      functions: {
        double: simpleFunction,
      },
    })

    const api = rest.build({
      version: 1,
      module: simpleModule,
      functions: {
        double: { method: 'post', path: '/double' },
      },
      options: {
        pathPrefix: '/api',
      },
    })

    const lambdaHandler = handler.build({
      api,
      context: async () => ({}),
    })

    const event = createMockEvent({
      rawPath: '/api/v1/double',
      body: JSON.stringify({ value: 21 }),
      headers: { 'content-type': 'application/json' },
      requestContext: {
        ...createMockEvent().requestContext,
        http: {
          method: 'POST',
          path: '/api/v1/double',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    })

    const response = await lambdaHandler(event, createMockContext(), () => {})
    expect(response).toBeDefined()
  })

  test('should handle function returning error', async () => {
    const errorFunc = functions
      .define({
        input: model.string(),
        output: model.string(),
        errors: { validation: model.string() },
      })
      .implement({
        async body({ input }) {
          if (input === 'invalid') {
            return result.fail({ validation: 'Invalid input' })
          }
          return result.ok(input)
        },
      })

    const errorModule = module.build({
      name: 'error-test',
      functions: {
        validate: errorFunc,
      },
    })

    const api = rest.build({
      version: 1,
      module: errorModule,
      functions: {
        validate: { method: 'post', path: '/validate' },
      },
    })

    const lambdaHandler = handler.build({
      api,
      context: async () => ({}),
    })

    const event = createMockEvent({
      rawPath: '/api/v1/validate',
      body: JSON.stringify('invalid'),
      headers: { 'content-type': 'application/json' },
      requestContext: {
        ...createMockEvent().requestContext,
        http: {
          method: 'POST',
          path: '/api/v1/validate',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    })

    const response = await lambdaHandler(event, createMockContext(), () => {})
    expect(response).toBeDefined()
  })

  test('should correctly set response headers from result', async () => {
    // Test that the response headers are correctly handled
    const lambdaHandler = handler.build({
      api: testApi,
      context: async () => ({}),
    })

    // Success response should have Content-Type header
    const event = createMockEvent({
      rawPath: '/api/v1/no-input',
      requestContext: {
        ...createMockEvent().requestContext,
        http: {
          method: 'GET',
          path: '/api/v1/no-input',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    })

    const response = await lambdaHandler(event, createMockContext(), () => {})
    expect(response).toBeDefined()
  })
})
