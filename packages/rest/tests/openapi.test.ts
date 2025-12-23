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
})
