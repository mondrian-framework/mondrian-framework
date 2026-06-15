import { serve } from '../src'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import fastify, { FastifyInstance } from 'fastify'
import { describe, test, expect, beforeEach, afterEach } from 'vitest'

// Simple function definitions for testing
const simpleFunc = functions.define({
  input: model.string(),
  output: model.string(),
})

const noInputFunc = functions.define({
  output: model.string(),
})

const createModuleAndApi = (options?: { pathPrefix?: string }) => {
  const moduleInterface = module.define({
    functions: { simpleFunc, noInputFunc },
    name: 'test-module',
  })

  const simpleFuncImpl = simpleFunc.implement({
    async body({ input }) {
      return result.ok(`Hello, ${input}!`)
    },
  })

  const noInputFuncImpl = noInputFunc.implement({
    async body() {
      return result.ok('No input needed')
    },
  })

  const moduleImpl = moduleInterface.implement({
    functions: {
      simpleFunc: simpleFuncImpl,
      noInputFunc: noInputFuncImpl,
    },
  })

  const restDefinition = rest.define({
    module: moduleInterface,
    version: 2,
    functions: {
      simpleFunc: { method: 'post', path: '/simple' },
      noInputFunc: { method: 'get', path: '/no-input' },
    },
    options: options ? { pathPrefix: options.pathPrefix } : undefined,
  })

  const api = rest.build({ ...restDefinition, module: moduleImpl })
  return { api, moduleImpl, restDefinition }
}

describe('serve function', () => {
  let server: FastifyInstance

  beforeEach(() => {
    server = fastify()
  })

  afterEach(async () => {
    await server.close()
  })

  describe('introspection endpoints', () => {
    test('should serve introspection endpoints when enabled', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      // Test index.html
      const indexResponse = await server.inject({
        method: 'GET',
        url: '/docs/index.html',
      })
      expect(indexResponse.statusCode).toBe(200)
      expect(indexResponse.headers['content-type']).toContain('text/html')

      // Test swagger.html
      const swaggerResponse = await server.inject({
        method: 'GET',
        url: '/docs/swagger.html',
      })
      expect(swaggerResponse.statusCode).toBe(200)
      expect(swaggerResponse.headers['content-type']).toContain('text/html')

      // Test redoc.html
      const redocResponse = await server.inject({
        method: 'GET',
        url: '/docs/redoc.html',
      })
      expect(redocResponse.statusCode).toBe(200)
      expect(redocResponse.headers['content-type']).toContain('text/html')

      // Test scalar.html
      const scalarResponse = await server.inject({
        method: 'GET',
        url: '/docs/scalar.html',
      })
      expect(scalarResponse.statusCode).toBe(200)
      expect(scalarResponse.headers['content-type']).toContain('text/html')

      // Test redirect from /docs to /docs/index.html
      const redirectResponse = await server.inject({
        method: 'GET',
        url: '/docs',
      })
      expect(redirectResponse.statusCode).toBe(302)
      expect(redirectResponse.headers.location).toBe('/docs/index.html')
    })

    test('should handle introspection path with trailing slash', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/api-docs/',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const indexResponse = await server.inject({
        method: 'GET',
        url: '/api-docs/index.html',
      })
      expect(indexResponse.statusCode).toBe(200)
    })

    test('should not serve UI endpoints when ui is set to none', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'none',
          },
        },
      })

      await server.listen({ port: 0 })

      // UI endpoints should not exist when ui: 'none'
      const indexResponse = await server.inject({
        method: 'GET',
        url: '/docs/index.html',
      })
      expect(indexResponse.statusCode).toBe(404)

      // But schema endpoint should still work
      const schemaResponse = await server.inject({
        method: 'GET',
        url: '/docs/v1/schema.json',
      })
      expect(schemaResponse.statusCode).toBe(200)
    })

    test('should not create redirect when introspection path is root', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      // Should be able to access index.html directly
      const indexResponse = await server.inject({
        method: 'GET',
        url: '/index.html',
      })
      expect(indexResponse.statusCode).toBe(200)
    })
  })

  describe('schema.json endpoint', () => {
    test('should return schema for valid version', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const schemaResponse = await server.inject({
        method: 'GET',
        url: '/docs/v1/schema.json',
      })
      expect(schemaResponse.statusCode).toBe(200)
      const schema = JSON.parse(schemaResponse.body)
      expect(schema.openapi).toBeDefined()
    })

    test('should return schema for max version', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const schemaResponse = await server.inject({
        method: 'GET',
        url: '/docs/v2/schema.json',
      })
      expect(schemaResponse.statusCode).toBe(200)
    })

    test('should cache schema responses', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      // First request - should generate schema
      const firstResponse = await server.inject({
        method: 'GET',
        url: '/docs/v1/schema.json',
      })
      expect(firstResponse.statusCode).toBe(200)
      const firstSchema = JSON.parse(firstResponse.body)

      // Second request - should return cached schema
      const secondResponse = await server.inject({
        method: 'GET',
        url: '/docs/v1/schema.json',
      })
      expect(secondResponse.statusCode).toBe(200)
      const secondSchema = JSON.parse(secondResponse.body)

      expect(firstSchema).toEqual(secondSchema)
    })

    test('should return 404 for invalid version (NaN)', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'GET',
        url: '/docs/vinvalid/schema.json',
      })
      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid version')
    })

    test('should return 404 for version 0', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'GET',
        url: '/docs/v0/schema.json',
      })
      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid version')
      expect(body.minVersion).toBe('v1')
    })

    test('should return 404 for version exceeding max', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'GET',
        url: '/docs/v99/schema.json',
      })
      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid version')
      expect(body.maxVersion).toBe('v2')
    })

    test('should return 404 for non-integer version', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: {
            path: '/docs',
            ui: 'swagger',
          },
        },
      })

      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'GET',
        url: '/docs/v1.5/schema.json',
      })
      expect(response.statusCode).toBe(404)
    })
  })

  describe('path prefix', () => {
    test('should use custom pathPrefix from api options', async () => {
      const { api } = createModuleAndApi({ pathPrefix: '/custom-api' })

      serve({
        server,
        api,
        context: async () => ({}),
      })

      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'POST',
        url: '/custom-api/v1/simple',
        payload: JSON.stringify('World'),
        headers: {
          'content-type': 'application/json',
        },
      })
      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('Hello, World!')
    })

    test('should use default /api prefix when not specified', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
      })

      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/simple',
        payload: JSON.stringify('World'),
        headers: {
          'content-type': 'application/json',
        },
      })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('without introspection', () => {
    test('should work without introspection options', async () => {
      const { api } = createModuleAndApi()

      serve({
        server,
        api,
        context: async () => ({}),
        options: {
          introspection: false,
        },
      })

      await server.listen({ port: 0 })

      // Function endpoints should still work
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/no-input',
      })
      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('No input needed')
    })
  })

  describe('handler returns response without headers', () => {
    test('skips reply.headers when onError returns response without headers', async () => {
      // Trigger the handler's catch block by sending input that fails decoding
      // for a function without a BadInput error type — this throws InvalidInput.
      // Then onError returns a response without headers, exercising the false
      // branch of `if (result.headers)` in methods.ts.
      const objectInput = functions.define({
        input: model.object({ a: model.string() }),
        output: model.string(),
      })
      const moduleInterface = module.define({
        functions: { objectInput },
        name: 'on-error-module',
      })
      const moduleImpl = moduleInterface.implement({
        functions: {
          objectInput: objectInput.implement({
            async body({ input }) {
              return result.ok(input.a)
            },
          }),
        },
      })
      const api = rest.build({
        module: moduleImpl,
        version: 1,
        functions: { objectInput: { method: 'post', path: '/obj' } },
      })

      let onErrorCalled = false
      serve({
        server,
        api,
        context: async () => ({}),
        onError: async () => {
          onErrorCalled = true
          // Return a response without headers to exercise the false branch.
          return { status: 503, body: 'unavailable' }
        },
      })
      await server.listen({ port: 0 })

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/obj',
        payload: JSON.stringify(123), // wrong type — should fail input decode
        headers: { 'content-type': 'application/json' },
      })
      expect(onErrorCalled).toBe(true)
      expect(response.statusCode).toBe(503)
      expect(response.body).toBe('unavailable')
    })
  })

  describe('skipping unexposed functions', () => {
    test('skips functions that have no rest specification', async () => {
      // Build a module with two functions but register only one in the rest api.
      // This exercises the `if (!specifications) continue` guard in methods.ts.
      const exposed = functions.define({
        input: model.string(),
        output: model.string(),
      })
      const hidden = functions.define({
        input: model.string(),
        output: model.string(),
      })
      const moduleInterface = module.define({
        functions: { exposed, hidden },
        name: 'partialModule',
      })
      const moduleImpl = moduleInterface.implement({
        functions: {
          exposed: exposed.implement({
            async body({ input }) {
              return result.ok(`echo:${input}`)
            },
          }),
          hidden: hidden.implement({
            async body({ input }) {
              return result.ok(input)
            },
          }),
        },
      })
      const api = rest.build({
        module: moduleImpl,
        version: 1,
        functions: {
          exposed: { method: 'post', path: '/exposed' },
          // 'hidden' intentionally omitted
        },
      })

      serve({
        server,
        api,
        context: async () => ({}),
      })
      await server.listen({ port: 0 })

      const exposedResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/exposed',
        payload: JSON.stringify('hi'),
        headers: { 'content-type': 'application/json' },
      })
      expect(exposedResponse.statusCode).toBe(200)
      expect(exposedResponse.body).toBe('echo:hi')

      // The hidden function should not be exposed.
      const hiddenResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/hidden',
        payload: JSON.stringify('hi'),
        headers: { 'content-type': 'application/json' },
      })
      expect(hiddenResponse.statusCode).toBe(404)
    })
  })
})
