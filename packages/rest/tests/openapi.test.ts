import { rest } from '../src'
import { emptyInternalData, clearInternalData, generateOpenapiInput } from '../src/openapi'
import { decoding, model, validation } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import gen from 'fast-check'
import { describe, expect, test, vi } from 'vitest'

describe('module to openapi', () => {
  test('works on simple module', () => {
    const m = module.define({
      name: 'name',
      functions: {
        toString: functions.define({
          input: model.number(),
          output: model.string(),
          errors: undefined,
          retrieve: undefined,
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: {
          toString: { method: 'get' },
        },
      },
    })

    expect(openapi).toEqual({
      openapi: '3.1.0',
      info: { version: 'v1', title: 'name' },
      servers: [{ url: '/api/v1' }],
      paths: {
        '/toString': {
          get: {
            parameters: [{ name: 'input', in: 'query', required: true, explode: true, schema: { type: 'number' } }],
            responses: {
              '200': { description: 'Success', content: { 'application/json': { schema: { type: 'string' } } } },
            },
            tags: [],
          },
        },
      },
      components: { schemas: {} },
    })
  })

  test("don't work if path param is not a scalar", () => {
    const m = module.define({
      name: 'name',
      functions: {
        toString: functions.define({
          input: model.object({ a: model.object({}) }),
          output: model.string(),
        }),
      },
    })

    expect(() =>
      rest.openapi.fromModule({
        version: 1,
        api: {
          module: m,
          version: 1,
          functions: { toString: { method: 'get', path: '/toString/{a}' } },
        },
      }),
    ).toThrowError(
      'Error while generating openapi input type. Path parameter a can only be a scalar type. Path /toString/{a}',
    )
  })

  test("don't work if path param is inside an array", () => {
    const m = module.define({
      name: 'name',
      functions: {
        toString: functions.define({
          input: model.object({ a: model.string().optional() }).array(),
          output: model.string(),
        }),
      },
    })

    expect(() =>
      rest.openapi.fromModule({
        version: 1,
        api: {
          module: m,
          version: 1,
          functions: { toString: { method: 'get', path: '/toString/{a}' } },
        },
      }),
    ).toThrowError(
      'Error while generating openapi input type. Path parameter with array are not supported. Path /toString/{a}',
    )
  })

  test("don't work with multiple path parameters if input is scalar", () => {
    const m = module.define({
      name: 'name',
      functions: {
        toString: functions.define({
          input: model.string().optional(),
          output: model.string(),
        }),
      },
    })

    expect(() =>
      rest.openapi.fromModule({
        version: 1,
        api: {
          module: m,
          version: 1,
          functions: { toString: { method: 'get', path: '/toString/{a}/{b}' } },
        },
      }),
    ).toThrowError('Error while generating openapi input type. Only one parameter is needed. Path /toString/{a}/{b}')
  })

  test('works on more complex module', () => {
    const postCategory = model.enumeration(['FUNNY', 'QUESTION']).setName('PostCategory')
    const user = () =>
      model.entity({
        username: model.string(),
        posts: model.array(post),
        registeredAt: model.datetime(),
      })
    const post = () =>
      model.entity({
        title: model.string({ minLength: 1, maxLength: 2000 }),
        content: model.string(),
        author: model.nullable(user),
        likes: model.array(user),
        visualizations: model.integer({ minimum: 0 }),
        categories: model.array(postCategory).optional(),
      })
    const m = module.define({
      name: 'name',
      functions: {
        getPosts: functions.define({
          input: model.object({ userId: model.string(), limit: model.integer().optional() }),
          output: model.array(post),
        }),
        getUsers: functions.define({
          input: model.object({ start: model.integer(), limit: model.integer() }),
          output: model.array(user),
        }),
        createUser: functions.define({
          input: user,
          output: user,
          errors: { invalidInput: model.string(), notLoggedIn: model.string(), tooManyRequests: model.string() },
          options: { description: 'Creates a new user', namespace: 'Managment' },
        }),
        getNone: functions.define({
          output: model.undefined(),
        }),
        getAll: functions.define({
          output: model.entity({
            boolean: model.boolean(),
            literal1: model.literal(true),
            literal2: model.literal('true'),
            literal3: model.literal(123),
            literal4: model.null(),
            literal5: model.undefined(),
            record: model.record(model.string()),
            email: model.email(),
            unknown: model.unknown(),
            json: model.json(),
            timestapm: model.timestamp(),
            never: model.never(),
            union: model.union({ a: model.string(), b: model.number() }),
            custom1: model.custom<'custom1', {}, string>({
              typeName: 'custom1',
              encoder: (value) => value,
              decoder: (value) => decoding.succeed(value as string),
              validator: () => validation.succeed(),
              arbitrary: () => gen.constant('custom1'),
              options: {
                description: 'a',
                apiType: model.string({ minLength: 1, description: 'b' }),
              },
            }),
            custom2: model.custom<'custom2', {}, string>({
              typeName: 'custom2',
              encoder: (value) => value,
              decoder: (value) => decoding.succeed(value as string),
              validator: () => validation.succeed(),
              arbitrary: () => gen.constant('custom2'),
              options: {
                description: 'a',
                apiType: () => model.string({ minLength: 1, description: 'b', name: 'ApiCustom2' }),
              },
            }),
          }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 2,
      api: {
        module: m,
        options: { pathPrefix: 'API' },
        version: 3,
        functions: {
          getPosts: { method: 'get', path: '/posts/{userId}' },
          getUsers: [
            { method: 'post', path: '/users' },
            { method: 'get', path: '/users' },
            { method: 'get', path: '/old_users', version: { max: 1 } },
            { method: 'get', path: '/new_users', version: { min: 3 } },
          ],
          createUser: [
            { method: 'post', errorCodes: {}, responseHeaders: { 'X-Total-Count': { schema: { type: 'integer' } } } },
          ],
          getAll: { method: 'post' },
        },
        errorCodes: { tooManyRequests: 429 },
      },
    })

    expect(openapi).toEqual({
      openapi: '3.1.0',
      info: { version: 'v3', title: 'name' },
      servers: [{ url: 'API/v2' }],
      paths: {
        '/posts/{userId}': {
          get: {
            parameters: [
              { in: 'path', name: 'userId', required: true, schema: { type: 'string' } },
              { name: 'limit', in: 'query', required: false, explode: true, schema: { type: 'integer' } },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/post' } } },
                },
              },
            },
            tags: [],
          },
        },
        '/users': {
          post: {
            parameters: [],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['start', 'limit'],
                    properties: { start: { type: 'integer' }, limit: { type: 'integer' } },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/user' } } },
                },
              },
            },
            tags: [],
          },
          get: {
            parameters: [
              { name: 'start', in: 'query', required: true, explode: true, schema: { type: 'integer' } },
              { name: 'limit', in: 'query', required: true, explode: true, schema: { type: 'integer' } },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/user' } } },
                },
              },
            },
            tags: [],
          },
        },
        '/createUser': {
          post: {
            parameters: [],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/user' } } } },
            responses: {
              '200': {
                description: 'Success',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/user' } } },
                headers: { 'X-Total-Count': { schema: { type: 'integer' } } },
              },
              '400': {
                description: 'Error',
                content: {
                  'application/json': {
                    schema: {
                      anyOf: [
                        {
                          type: 'object',
                          required: ['invalidInput'],
                          properties: { invalidInput: { type: 'string' } },
                        },
                        { type: 'object', required: ['notLoggedIn'], properties: { notLoggedIn: { type: 'string' } } },
                      ],
                    },
                  },
                },
              },
              '429': {
                description: 'Error',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['tooManyRequests'],
                      properties: { tooManyRequests: { type: 'string' } },
                    },
                  },
                },
              },
            },
            description: 'Creates a new user',
            tags: ['Managment'],
          },
        },
        '/getAll': {
          post: {
            parameters: [],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: [
                        'boolean',
                        'literal1',
                        'literal2',
                        'literal3',
                        'literal4',
                        'literal5',
                        'record',
                        'email',
                        'unknown',
                        'json',
                        'timestapm',
                        'never',
                        'union',
                        'custom1',
                        'custom2',
                      ],
                      properties: {
                        boolean: { type: 'boolean' },
                        literal1: { type: 'boolean', const: true, example: true },
                        literal2: { type: 'string', const: 'true', example: 'true' },
                        literal3: { type: 'number', const: 123, example: 123 },
                        literal4: { type: 'null', const: null },
                        literal5: { type: 'null', const: null },
                        record: { type: 'object', additionalProperties: { type: 'string' } },
                        email: { type: 'string', format: 'email' },
                        unknown: {},
                        json: {},
                        timestapm: { type: 'integer', description: 'unix timestamp' },
                        never: {},
                        union: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                        custom1: {
                          description: 'a',
                          example: 'custom1',
                          minLength: 1,
                          type: 'string',
                        },
                        custom2: {
                          $ref: '#/components/schemas/ApiCustom2',
                        },
                      },
                    },
                  },
                },
              },
            },
            tags: [],
          },
        },
      },
      components: {
        schemas: {
          ApiCustom2: {
            description: 'b',
            minLength: 1,
            type: 'string',
          },
          user: {
            type: 'object',
            required: ['username', 'registeredAt'],
            properties: {
              username: { type: 'string' },
              posts: { type: 'array', items: { $ref: '#/components/schemas/post' } },
              registeredAt: { type: 'string', format: 'date-time' },
            },
          },
          PostCategory: { type: 'string', enum: ['FUNNY', 'QUESTION'] },
          post: {
            type: 'object',
            required: ['title', 'content', 'visualizations'],
            properties: {
              title: { type: 'string', minLength: 1, maxLength: 2000 },
              content: { type: 'string' },
              author: { anyOf: [{ $ref: '#/components/schemas/user' }, { type: 'null', const: null }] },
              likes: { type: 'array', items: { $ref: '#/components/schemas/user' } },
              visualizations: { type: 'integer', minimum: 0 },
              categories: { type: 'array', items: { $ref: '#/components/schemas/PostCategory' } },
            },
          },
        },
      },
    })
  })

  test('handles module with description', () => {
    const m = module.define({
      name: 'MyAPI',
      description: 'This is a test API\nWith multiple lines',
      functions: {
        test: functions.define({
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    expect(openapi.info.description).toBe('This is a test API</br>With multiple lines')
  })

  test('handles custom endpoints', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
        options: {
          endpoints: ['https://api.example.com', 'https://staging.example.com'],
        },
      },
    })

    expect(openapi.servers).toEqual([
      { url: 'https://api.example.com/api/v1' },
      { url: 'https://staging.example.com/api/v1' },
    ])
  })

  test('handles custom path prefix', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
        options: { pathPrefix: '/custom-api' },
      },
    })

    expect(openapi.servers).toEqual([{ url: '/custom-api/v1' }])
  })

  test('handles securities', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', security: [{ bearerAuth: [] }] } },
        securities: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    })

    expect(openapi.components?.securitySchemes).toEqual({
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    })
    expect(openapi.paths!['/test']?.get?.security).toEqual([{ bearerAuth: [] }])
  })

  test('handles array output', () => {
    const m = module.define({
      name: 'name',
      functions: {
        list: functions.define({
          output: model.array(model.string()),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { list: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/list']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema).toEqual({
      type: 'array',
      items: { type: 'string' },
    })
  })

  test('handles response headers', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: {
          test: {
            method: 'get',
            responseHeaders: {
              'X-Custom-Header': { schema: { type: 'string' }, description: 'A custom header' },
            },
          },
        },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.headers).toEqual({
      'X-Custom-Header': { schema: { type: 'string' }, description: 'A custom header' },
    })
  })

  test('handles nullable type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.nullable(model.string()),
          output: model.nullable(model.string()),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'post' } },
      },
    })

    const response = openapi.paths!['/test']?.post?.responses?.['200'] as any
    expect(response.content['application/json'].schema).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null', const: null }],
    })
  })

  test('handles optional type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.optional(model.string()),
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const param = openapi.paths!['/test']?.get?.parameters?.[0] as any
    expect(param.required).toBe(false)
  })

  test('handles union type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.union({ str: model.string(), num: model.number() }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    })
  })

  test('handles uuid type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.uuid(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema).toEqual({ type: 'string', format: 'uuid' })
  })

  test('handles url type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.url(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema).toEqual({ type: 'string', format: 'url' })
  })

  test('handles jwt type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.jwt({ sub: model.string() }, 'ES256'),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.type).toBe('string')
    expect(response.content['application/json'].schema.contentMediaType).toBe('application/jwt')
  })

  test('handles delete method', () => {
    const m = module.define({
      name: 'name',
      functions: {
        remove: functions.define({
          input: model.string(),
          output: model.boolean(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { remove: { method: 'delete', path: '/items/{id}' } },
      },
    })

    expect(openapi.paths!['/items/{id}']?.delete).toBeDefined()
  })

  test('skips function not in specifications', () => {
    const m = module.define({
      name: 'name',
      functions: {
        exposed: functions.define({ output: model.string() }),
        notExposed: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { exposed: { method: 'get' } },
      },
    })

    expect(openapi.paths!['/exposed']).toBeDefined()
    expect(openapi.paths!['/notExposed']).toBeUndefined()
  })

  test('handles namespace from function options', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string(),
          options: { namespace: 'Admin' },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    expect(openapi.paths!['/test']?.get?.tags).toEqual(['Admin'])
  })

  test('handles namespace from specification', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', namespace: 'Public' } },
      },
    })

    expect(openapi.paths!['/test']?.get?.tags).toEqual(['Public'])
  })

  test('handles namespace null to remove tags', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string(),
          options: { namespace: 'Admin' },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', namespace: null } },
      },
    })

    expect(openapi.paths!['/test']?.get?.tags).toEqual([])
  })

  test('handles content type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({ output: model.string() }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', contentType: 'text/csv' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['text/csv']).toBeDefined()
  })

  test('handles inputName option', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.string(),
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', inputName: 'query' } },
      },
    })

    const param = openapi.paths!['/test']?.get?.parameters?.[0] as any
    expect(param.name).toBe('query')
  })
})

describe('generateOpenapiInput', () => {
  test('handles body with path parameters', () => {
    const functionBody = functions.define({
      input: model.object({ id: model.string(), data: model.object({ name: model.string() }) }),
      output: model.string(),
    })

    const internalData = emptyInternalData(undefined)
    const result = generateOpenapiInput({
      specification: { method: 'post', path: '/items/{id}' },
      functionName: 'update',
      functionBody,
      internalData,
    })

    expect(result.parameters?.length).toBe(1)
    expect(result.requestBody).toBeDefined()
    clearInternalData(internalData)
  })

  test('handles body without path parameters', () => {
    const functionBody = functions.define({
      input: model.object({ name: model.string() }),
      output: model.string(),
    })

    const internalData = emptyInternalData(undefined)
    const result = generateOpenapiInput({
      specification: { method: 'post' },
      functionName: 'create',
      functionBody,
      internalData,
    })

    expect(result.parameters).toBeUndefined()
    expect(result.requestBody).toBeDefined()
    clearInternalData(internalData)
  })

  test('output function encodes path correctly', () => {
    const functionBody = functions.define({
      input: model.object({ id: model.string(), name: model.string() }),
      output: model.string(),
    })

    const internalData = emptyInternalData(undefined)
    const result = generateOpenapiInput({
      specification: { method: 'get', path: '/items/{id}' },
      functionName: 'get',
      functionBody,
      internalData,
    })

    const output = result.output({ id: '123', name: 'test' })
    expect(output.path).toBe('/items/123')
    expect(output.params).toBe('name=test')
    clearInternalData(internalData)
  })

  test('handles POST with array input (no path params)', () => {
    const functionBody = functions.define({
      input: model.array(model.string()),
      output: model.string(),
    })

    const internalData = emptyInternalData(undefined)
    const result = generateOpenapiInput({
      specification: { method: 'post' },
      functionName: 'create',
      functionBody,
      internalData,
    })

    expect(result.requestBody).toBeDefined()
    clearInternalData(internalData)
  })
})

describe('emptyInternalData and clearInternalData', () => {
  test('creates empty internal data', () => {
    const data = emptyInternalData(undefined)
    expect(data.typeMap.size).toBe(0)
    expect(data.typeRef.size).toBe(0)
  })

  test('creates internal data with custom type schemas', () => {
    const customSchemas = { myType: { type: 'string' as const } }
    const data = emptyInternalData(customSchemas)
    expect(data.customTypeSchemas).toBe(customSchemas)
  })

  test('clears internal data', () => {
    const data = emptyInternalData(undefined)
    data.typeMap.set('test', { type: 'string' })
    data.typeRef.set(model.string, 'test')

    clearInternalData(data)

    expect(data.typeMap.size).toBe(0)
    expect(data.typeRef.size).toBe(0)
  })
})

describe('additional openapi types', () => {
  test('handles custom type with custom schema', () => {
    const myCustomType = model.custom<'myCustom', {}, string>({
      typeName: 'myCustom',
      encoder: (v) => v,
      decoder: (v) => decoding.succeed(v as string),
      validator: () => validation.succeed(),
      arbitrary: () => gen.constant('test'),
    })

    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: myCustomType,
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
        customTypeSchemas: {
          myCustom: { type: 'string', pattern: '^[a-z]+$' },
        },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.pattern).toBe('^[a-z]+$')
  })

  test('handles custom type with function schema', () => {
    const myCustomType = model.custom<'myCustomFn', {}, string>({
      typeName: 'myCustomFn',
      encoder: (v) => v,
      decoder: (v) => decoding.succeed(v as string),
      validator: () => validation.succeed(),
      arbitrary: () => gen.constant('test'),
    })

    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: myCustomType,
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
        customTypeSchemas: {
          myCustomFn: (type) => ({ type: 'string', description: `Type: ${type.typeName}` }),
        },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('Type: myCustomFn')
  })

  test('handles unknown custom type with warning', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const unknownType = model.custom<'unknownType', {}, string>({
      typeName: 'unknownType',
      encoder: (v) => v,
      decoder: (v) => decoding.succeed(v as string),
      validator: () => validation.succeed(),
      arbitrary: () => gen.constant('unknown'),
    })

    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: unknownType,
        }),
      },
    })

    rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("don't known how to properly map custom type"))

    consoleWarnSpy.mockRestore()
  })

  test('handles nullable with existing anyOf schema', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.nullable(model.union({ a: model.string(), b: model.number() })),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.anyOf.length).toBe(3)
  })

  test('handles optional with existing anyOf schema', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.optional(model.union({ a: model.string(), b: model.number() })),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.anyOf.length).toBe(3)
  })

  test('handles multiple endpoints on same path', () => {
    const m = module.define({
      name: 'name',
      functions: {
        getItem: functions.define({
          input: model.string(),
          output: model.string(),
        }),
        updateItem: functions.define({
          input: model.object({ id: model.string(), data: model.string() }),
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: {
          getItem: { method: 'get', path: '/items/{id}' },
          updateItem: { method: 'post', path: '/items/{id}' },
        },
      },
    })

    expect(openapi.paths!['/items/{id}']?.get).toBeDefined()
    expect(openapi.paths!['/items/{id}']?.post).toBeDefined()
  })

  test('handles retrieve type in openapi', () => {
    const userType = () =>
      model.entity({
        id: model.string(),
        name: model.string(),
        age: model.optional(model.integer()),
      })

    const m = module.define({
      name: 'name',
      functions: {
        getUser: functions.define({
          input: model.string(),
          output: userType,
          retrieve: { select: true },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { getUser: { method: 'get' } },
      },
    })

    const params = openapi.paths!['/getUser']?.get?.parameters as any[]
    const selectParam = params.find((p: any) => p.name === 'select')

    expect(selectParam).toBeDefined()
    expect(selectParam.required).toBe(false)
  })

  test('handles multiple error codes grouped by status', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string(),
          errors: {
            badInput: model.string(),
            invalidFormat: model.string(),
            unauthorized: model.string(),
          },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: {
          test: {
            method: 'post',
            errorCodes: { unauthorized: 401 },
          },
        },
      },
    })

    const responses = openapi.paths!['/test']?.post?.responses as any
    expect(responses['400']).toBeDefined()
    expect(responses['401']).toBeDefined()
    // 400 should have anyOf with both badInput and invalidFormat
    expect(responses['400'].content['application/json'].schema.anyOf.length).toBe(2)
  })

  test('handles literal type with unknown value type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.object({
            stringLit: model.literal('hello'),
            numLit: model.literal(42),
            boolLit: model.literal(true),
          }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    const schema = response.content['application/json'].schema
    expect(schema.properties.stringLit.const).toBe('hello')
    expect(schema.properties.numLit.const).toBe(42)
    expect(schema.properties.boolLit.const).toBe(true)
  })

  test('handles deeply nested object structure', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.object({
            level1: model.object({
              level2: model.object({
                value: model.string(),
              }),
            }),
          }),
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'post' } },
      },
    })

    const requestBody = openapi.paths!['/test']?.post?.requestBody as any
    expect(
      requestBody.content['application/json'].schema.properties.level1.properties.level2.properties.value.type,
    ).toBe('string')
  })

  test('throws error for unsupported input type with GET method (union at root)', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.union({ a: model.string(), b: model.number() }),
          output: model.string(),
        }),
      },
    })

    expect(() =>
      rest.openapi.fromModule({
        version: 1,
        api: {
          module: m,
          version: 1,
          functions: { test: { method: 'get', path: '/test/{id}' } },
        },
      }),
    ).toThrowError('Error while generating openapi input type. Not supported. Path /test/{id}')
  })

  test('handles nullable type with ignoreFirstLevelOptionality in path parameter', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.nullable(model.string()),
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', path: '/test/{id}' } },
      },
    })

    const param = openapi.paths!['/test/{id}']?.get?.parameters?.[0] as any
    expect(param.name).toBe('id')
    expect(param.required).toBe(true)
    // Schema should not have anyOf since ignoreFirstLevelOptionality is true for path params
    expect(param.schema.type).toBe('string')
  })

  test('handles optional type with ignoreFirstLevelOptionality in path parameter', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.optional(model.string()),
          output: model.string(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get', path: '/test/{id}' } },
      },
    })

    const param = openapi.paths!['/test/{id}']?.get?.parameters?.[0] as any
    expect(param.name).toBe('id')
    expect(param.required).toBe(true)
    expect(param.schema.type).toBe('string')
  })

  test('handles function description with newlines', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string(),
          options: {
            description: 'First line\nSecond line\nThird line',
          },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    expect(openapi.paths!['/test']?.get?.description).toBe('First line</br>Second line</br>Third line')
  })

  test('handles type descriptions in string type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string({ description: 'A test string' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A test string')
  })

  test('handles type descriptions in number type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.number({ description: 'A test number' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A test number')
  })

  test('handles type descriptions in boolean type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.boolean({ description: 'A test boolean' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A test boolean')
  })

  test('handles type descriptions in enum type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.enumeration(['A', 'B'], { description: 'A test enum' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A test enum')
  })

  test('handles type descriptions in literal type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.literal('constant', { description: 'A constant value' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A constant value')
  })

  test('handles type descriptions in array type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.array(model.string(), { description: 'A list of strings', minItems: 1, maxItems: 10 }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A list of strings')
    expect(response.content['application/json'].schema.minItems).toBe(1)
    expect(response.content['application/json'].schema.maxItems).toBe(10)
  })

  test('handles type descriptions in union type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.union({ a: model.string(), b: model.number() }, { description: 'A union type' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A union type')
  })

  test('handles type descriptions in optional type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.optional(model.string(), { description: 'An optional string' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('An optional string')
  })

  test('handles type descriptions in nullable type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.nullable(model.string(), { description: 'A nullable string' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('A nullable string')
  })

  test('handles string type with regex pattern', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string({ regex: /^[a-z]+$/ }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.pattern).toBe('^[a-z]+$')
  })

  test('handles string type with minLength and maxLength', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.string({ minLength: 5, maxLength: 100 }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.minLength).toBe(5)
    expect(response.content['application/json'].schema.maxLength).toBe(100)
  })

  test('handles number type with bounds', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.number({ minimum: 0, maximum: 100, exclusiveMinimum: 0, exclusiveMaximum: 100 }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.minimum).toBe(0)
    expect(response.content['application/json'].schema.maximum).toBe(100)
    expect(response.content['application/json'].schema.exclusiveMinimum).toBe(0)
    expect(response.content['application/json'].schema.exclusiveMaximum).toBe(100)
  })

  test('handles integer type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.integer(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.type).toBe('integer')
  })

  test('handles object with field descriptions', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.object({
            name: model.string({ description: 'The user name' }),
            age: model.integer({ description: 'The user age' }),
          }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.properties.name.description).toBe('The user name')
    expect(response.content['application/json'].schema.properties.age.description).toBe('The user age')
  })

  test('handles TotalCountArray output type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        list: functions.define({
          output: model.array(model.string(), { totalCount: true }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { list: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/list']?.get?.responses?.['200'] as any
    expect(response.headers?.['x-total-count']).toBeDefined()
    expect(response.headers['x-total-count'].schema.type).toBe('integer')
  })

  test('handles nullable union with description on inner type', () => {
    const innerUnion = model.union({ a: model.string({ description: 'string opt' }), b: model.number() })
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.nullable(innerUnion),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    // Should merge anyOf from union with nullable
    expect(response.content['application/json'].schema.anyOf.length).toBe(3)
  })

  test('handles optional union with description on inner type', () => {
    const innerUnion = model.union({ a: model.string({ description: 'string opt' }), b: model.number() })
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.optional(innerUnion),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    // Should merge anyOf from union with optional
    expect(response.content['application/json'].schema.anyOf.length).toBe(3)
  })

  test('handles optional type with outer description overriding inner', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.optional(model.union({ a: model.string(), b: model.number() }, { description: 'inner desc' }), {
            description: 'outer desc',
          }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('outer desc')
  })

  test('handles nullable type with outer description overriding inner', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.nullable(model.union({ a: model.string(), b: model.number() }, { description: 'inner desc' }), {
            description: 'outer desc',
          }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.description).toBe('outer desc')
  })

  test('handles entity with _count field', () => {
    const user = () =>
      model.entity({
        id: model.string(),
        name: model.string(),
        _postCount: model.optional(model.integer()),
      })

    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: user,
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    // Entities may be defined as refs in OpenAPI schema
    // Just verify the response is properly defined
    expect(response).toBeDefined()
    expect(response.content['application/json']).toBeDefined()
    // The schema may be a $ref or inline object
    const schema = response.content['application/json'].schema
    expect(schema).toBeDefined()
  })

  test('handles record type with complex field type', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.record(model.object({ id: model.string(), value: model.number() })),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.type).toBe('object')
    expect(response.content['application/json'].schema.additionalProperties.type).toBe('object')
  })

  test('handles datetime type with description', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.datetime({ description: 'A date and time' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.format).toBe('date-time')
    expect(response.content['application/json'].schema.description).toBe('A date and time')
  })

  test('handles timestamp type with description', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.timestamp({ description: 'A timestamp' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.type).toBe('integer')
    expect(response.content['application/json'].schema.description).toBe('A timestamp')
  })

  test('handles email type with description', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.email({ description: 'An email address' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.format).toBe('email')
    expect(response.content['application/json'].schema.description).toBe('An email address')
  })

  test('handles uuid type with description', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.uuid({ description: 'A unique identifier' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.format).toBe('uuid')
    expect(response.content['application/json'].schema.description).toBe('A unique identifier')
  })

  test('handles url type with description', () => {
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          output: model.url({ description: 'A URL' }),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { test: { method: 'get' } },
      },
    })

    const response = openapi.paths!['/test']?.get?.responses?.['200'] as any
    expect(response.content['application/json'].schema.format).toBe('url')
    expect(response.content['application/json'].schema.description).toBe('A URL')
  })

  test('handles DELETE method with object input in query', () => {
    const m = module.define({
      name: 'name',
      functions: {
        deleteItem: functions.define({
          input: model.object({ id: model.string(), force: model.optional(model.boolean()) }),
          output: model.boolean(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { deleteItem: { method: 'delete' } },
      },
    })

    const params = openapi.paths!['/deleteItem']?.delete?.parameters as any[]
    expect(params.length).toBe(2)
    expect(params.find((p: any) => p.name === 'id')).toBeDefined()
    expect(params.find((p: any) => p.name === 'force')).toBeDefined()
  })

  test('handles GET method with non-scalar input requiring deepObject style', () => {
    const m = module.define({
      name: 'name',
      functions: {
        search: functions.define({
          input: model.object({
            filter: model.object({ name: model.optional(model.string()), age: model.optional(model.integer()) }),
          }),
          output: model.array(model.string()),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { search: { method: 'get' } },
      },
    })

    const param = openapi.paths!['/search']?.get?.parameters?.[0] as any
    expect(param.style).toBe('deepObject')
    expect(param.explode).toBe(true)
  })

  test('falls back to methodFromOptions when fromModule has no specification.method', () => {
    const m = module.define({
      name: 'noMethodFromModule',
      functions: {
        listItems: functions.define({
          input: model.string(),
          output: model.array(model.string()),
          options: { operation: 'query' },
        }),
      },
    })

    // No `method` set on the function specification: the schema generator should
    // fall back to methodFromOptions which yields 'get' for query operations.
    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        functions: { listItems: {} },
      },
    })

    expect(openapi.paths!['/listItems']?.get).toBeDefined()
    expect(openapi.paths!['/listItems']?.post).toBeUndefined()
  })

  test('GET output func handles undefined optional fields, scalar and non-scalar fields', async () => {
    const Filter = model.object({
      name: model.optional(model.string()),
      tags: model.array(model.string()),
    })
    const m = module.define({
      name: 'getOutputModule',
      functions: {
        search: functions.define({
          input: model.object({ q: model.optional(model.string()), filter: Filter }),
          output: model.array(model.string()),
        }),
      },
    })

    const impl = m.implement({
      functions: {
        search: functions
          .define({
            input: model.object({ q: model.optional(model.string()), filter: Filter }),
            output: model.array(model.string()),
          })
          .implement({
            async body() {
              return { isOk: true, value: ['ok'] } as any
            },
          }),
      },
    })

    const restApi = rest.build({
      version: 1,
      module: impl,
      functions: { search: { method: 'get' } },
    })

    const fetchCalls: { url: string; init: any }[] = []
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockImplementation((url: string, init: any) => {
      fetchCalls.push({ url, init })
      return Promise.resolve({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '["ok"]',
      } as any)
    }) as any

    try {
      const restClient = (await import('../src/client')).build({
        endpoint: 'http://localhost:3000',
        rest: restApi,
      })
      // q omitted -> exercises the `object[key] === undefined` continue branch.
      // filter is non-scalar -> exercises the encodeQueryObject branch.
      await (restClient.functions as any).search({ filter: { tags: ['a', 'b'] } })
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0]!.url).toContain('filter')
      expect(fetchCalls[0]!.url).not.toContain('q=')
    } finally {
      global.fetch = originalFetch
    }
  })

  test('GET output func produces no params when all optional fields omitted', async () => {
    const Search = model.object({ q: model.optional(model.string()) })
    const m = module.define({
      name: 'emptyParamsModule',
      functions: {
        search: functions.define({
          input: Search,
          output: model.string(),
        }),
      },
    })

    const impl = m.implement({
      functions: {
        search: functions.define({ input: Search, output: model.string() }).implement({
          async body() {
            return { isOk: true, value: 'ok' } as any
          },
        }),
      },
    })

    const restApi = rest.build({
      version: 1,
      module: impl,
      functions: { search: { method: 'get' } },
    })

    const fetchCalls: { url: string }[] = []
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push({ url })
      return Promise.resolve({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"ok"',
      } as any)
    }) as any

    try {
      const restClient = (await import('../src/client')).build({
        endpoint: 'http://localhost:3000',
        rest: restApi,
      })
      await (restClient.functions as any).search({})
      expect(fetchCalls.length).toBe(1)
      // No `?` because all fields are optional/undefined and params is undefined.
      expect(fetchCalls[0]!.url).toBe('http://localhost:3000/api/v1/search')
    } finally {
      global.fetch = originalFetch
    }
  })

  test('POST + path param + body output round-trips through client', async () => {
    const Item = model.object({ id: model.string(), name: model.string(), age: model.integer() })
    const m = module.define({
      name: 'postPathModule',
      functions: {
        update: functions.define({
          input: Item,
          output: model.string(),
        }),
      },
    })

    const impl = m.implement({
      functions: {
        update: functions.define({ input: Item, output: model.string() }).implement({
          async body() {
            return { isOk: true, value: 'ok' } as any
          },
        }),
      },
    })

    const restApi = rest.build({
      version: 1,
      module: impl,
      functions: { update: { method: 'post', path: '/items/{id}' } },
    })

    const fetchCalls: { url: string; init: any }[] = []
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockImplementation((url: string, init: any) => {
      fetchCalls.push({ url, init })
      return Promise.resolve({
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => '"ok"',
      } as any)
    }) as any

    try {
      const restClient = (await import('../src/client')).build({
        endpoint: 'http://localhost:3000',
        rest: restApi,
      })
      await (restClient.functions as any).update({ id: 'abc', name: 'foo', age: 7 })
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0]!.url).toBe('http://localhost:3000/api/v1/items/abc')
      const body = JSON.parse(fetchCalls[0]!.init.body)
      expect(body).toEqual({ name: 'foo', age: 7 })
      expect(body.id).toBeUndefined()
    } finally {
      global.fetch = originalFetch
    }
  })

  test('GET with object input where decodeQueryObject yields non-array for an array field', async () => {
    const Search = model.object({ tags: model.array(model.string()) })
    const m = module.define({
      name: 'arrayCoercion',
      functions: {
        search: functions.define({
          input: Search,
          output: model.string(),
        }),
      },
    })

    // Call generateOpenapiInput's `input` function directly with a query that
    // has `tags=value` (scalar, not array) for an array-typed field. This drives
    // the array coercion branch `object[key] = [v]`.
    const internalData = emptyInternalData(undefined)
    const { input } = generateOpenapiInput({
      functionName: 'search',
      functionBody: m.functions.search,
      internalData,
      specification: { method: 'get', path: '/search' },
    })
    clearInternalData(internalData)
    const decoded = input({
      body: undefined,
      headers: {},
      params: {},
      query: { tags: 'value' },
      method: 'get',
      route: '/search',
    } as any)
    expect(decoded).toEqual({ tags: ['value'] })
  })

  test('GET with object input where array field receives object query (no [0] key)', async () => {
    const Search = model.object({ tags: model.array(model.string()) })
    const m = module.define({
      name: 'arrayCoercionObject',
      functions: {
        search: functions.define({
          input: Search,
          output: model.string(),
        }),
      },
    })

    const internalData = emptyInternalData(undefined)
    const { input } = generateOpenapiInput({
      functionName: 'search',
      functionBody: m.functions.search,
      internalData,
      specification: { method: 'get', path: '/search' },
    })
    clearInternalData(internalData)
    // `tags[a]=value` -> decodeQueryObject yields { a: 'value' } (an object
    // without a '0' key), exercising the inner `v === null` and
    // `!Object.keys(v).includes('0')` sub-branches of the array coercion guard.
    const decoded = input({
      body: undefined,
      headers: {},
      params: {},
      query: { 'tags[a]': 'value' },
      method: 'get',
      route: '/search',
    } as any)
    expect(decoded).toEqual({ tags: [{ a: 'value' }] })
  })

  test('GET with object input where array field receives object query containing [0] key', async () => {
    const Search = model.object({ tags: model.array(model.string()) })
    const m = module.define({
      name: 'arrayPassThrough',
      functions: {
        search: functions.define({
          input: Search,
          output: model.string(),
        }),
      },
    })

    const internalData = emptyInternalData(undefined)
    const { input } = generateOpenapiInput({
      functionName: 'search',
      functionBody: m.functions.search,
      internalData,
      specification: { method: 'get', path: '/search' },
    })
    clearInternalData(internalData)
    // `tags[0]=value` -> decodeQueryObject yields { 0: 'value' } (object with
    // a '0' key), so coercion does NOT fire — exercises the `else` branch
    // `object[key] = v` of the array coercion guard.
    const decoded = input({
      body: undefined,
      headers: {},
      params: {},
      query: { 'tags[0]': 'value' },
      method: 'get',
      route: '/search',
    } as any)
    expect(decoded).toEqual({ tags: { 0: 'value' } })
  })

  test('handles literalToOpenAPIComponent unknown literal throw branch', async () => {
    // The exported public API `model.literal` only accepts string|number|boolean,
    // so the `unknown literal type` defensive branch is unreachable through it.
    // We construct a literal-like type with a forged bigint value to exercise it.
    const customLiteral = {
      kind: 'literal',
      literalValue: BigInt(1),
      options: undefined,
    } as any

    // Build a minimal module that includes the forged literal as an output type.
    // We invoke modelToSchema indirectly by reaching into the module's openapi
    // generation code path.
    const { generateOpenapiInput, emptyInternalData, clearInternalData } = await import('../src/openapi')
    // Construct a synthetic functionBody with the forged literal output to drive
    // the schema generator into literalToOpenAPIComponent.
    const m = module.define({
      name: 'literalUnknown',
      functions: {
        getThing: functions.define({
          input: model.string(),
          output: model.string(),
        }),
      },
    })
    const internalData = emptyInternalData(undefined)
    expect(() =>
      generateOpenapiInput({
        functionName: 'getThing',
        functionBody: {
          input: customLiteral,
          output: m.functions.getThing.output,
          errors: undefined,
          retrieve: undefined,
        } as any,
        internalData,
        specification: { method: 'post' },
      }),
    ).toThrowError('Unknown literal type')
    clearInternalData(internalData)
  })

  test('handles GET with array input and no path params (deepObject style)', () => {
    const m = module.define({
      name: 'arrayInput',
      functions: {
        f: functions.define({
          input: model.array(model.string()),
          output: model.string(),
        }),
      },
    })
    const openapi = rest.openapi.fromModule({
      version: 1,
      api: { module: m, version: 1, functions: { f: { method: 'get' } } },
    })
    const param = openapi.paths!['/f']?.get?.parameters?.[0] as any
    // Input is non-scalar (array) — exercises the falsy branch of the
    // `isScalar ? isRequired : true` and `isScalar ? undefined : 'deepObject'` ternaries.
    expect(param.style).toBe('deepObject')
    expect(param.required).toBe(true)
  })

  test('handles POST + path param with entity input', async () => {
    const Item = () => model.entity({ id: model.string(), name: model.string() })
    const m = module.define({
      name: 'entityPost',
      functions: {
        upsert: functions.define({
          input: Item,
          output: model.string(),
        }),
      },
    })
    const openapi = rest.openapi.fromModule({
      version: 1,
      api: { module: m, version: 1, functions: { upsert: { method: 'post', path: '/items/{id}' } } },
    })
    // Successfully generates the schema for entity inputs in the POST + path param case
    expect(openapi.paths!['/items/{id}']?.post).toBeDefined()
  })

  test('handles full retrieve capabilities with array, scalar, and non-scalar fields', () => {
    const userType = () =>
      model.entity(
        {
          id: model.string(),
          name: model.string(),
          age: model.optional(model.integer()),
        },
        { retrieve: { where: true, orderBy: true, take: true, skip: true } },
      )

    const m = module.define({
      name: 'fullRetrieve',
      functions: {
        listUsers: functions.define({
          input: model.literal(undefined),
          output: model.array(userType),
          retrieve: { select: true, where: true, orderBy: true, skip: true, take: true },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: { module: m, version: 1, functions: { listUsers: { method: 'get' } } },
    })

    const params = openapi.paths!['/listUsers']?.get?.parameters as any[]
    expect(params.find((p: any) => p.name === 'where')).toBeDefined()
    expect(params.find((p: any) => p.name === 'orderBy')).toBeDefined()
    expect(params.find((p: any) => p.name === 'skip')).toBeDefined()
    expect(params.find((p: any) => p.name === 'take')).toBeDefined()
    expect(params.find((p: any) => p.name === 'select')).toBeDefined()

    // Scalar retrieve fields don't get deepObject style.
    const skipParam = params.find((p: any) => p.name === 'skip')
    expect(skipParam.style).toBeUndefined()
    expect(skipParam.example).toBeUndefined()
    // Non-scalar fields use deepObject + null example.
    const whereParam = params.find((p: any) => p.name === 'where')
    expect(whereParam.style).toBe('deepObject')
    expect(whereParam.example).toBeNull()
    // orderBy is an array — exercises the `model.isArray(value) ? model.array(type) : type` true branch.
    const orderByParam = params.find((p: any) => p.name === 'orderBy')
    expect(orderByParam.schema.type).toBe('array')
  })

  test('namespace handling: tags use empty string when namespace is undefined fallback path', () => {
    const m = module.define({
      name: 'tagsNamespace',
      functions: {
        f1: functions.define({
          input: model.string(),
          output: model.string(),
          options: { namespace: 'NS' },
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      version: 1,
      api: {
        module: m,
        version: 1,
        // no namespace on specification — so chain `functionBody.options?.namespace ?? specification.namespace ?? ''`
        // exercises the namespace coalesce path
        functions: { f1: { method: 'get' } },
      },
    })

    const op = openapi.paths!['/f1']?.get as any
    expect(op.tags).toEqual(['NS'])
  })

  test('throws error for unsupported input type with POST method (union with path params)', () => {
    // Exercises the false branch of `if (concreteInputType.kind === Object || Entity)`
    // inside the body-can-exist branch (POST/PUT/PATCH) with parametersInPath > 0.
    const m = module.define({
      name: 'name',
      functions: {
        test: functions.define({
          input: model.union({ a: model.string(), b: model.number() }),
          output: model.string(),
        }),
      },
    })

    expect(() =>
      rest.openapi.fromModule({
        version: 1,
        api: {
          module: m,
          version: 1,
          functions: { test: { method: 'post', path: '/test/{id}' } },
        },
      }),
    ).toThrowError('Error while generating openapi input type. Not supported. Path /test/{id}')
  })
})
