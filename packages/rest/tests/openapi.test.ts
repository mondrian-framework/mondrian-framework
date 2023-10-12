import { rest } from '../src'
import { types } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'

describe('module to openapi', () => {
  //TODO: add more tests when openapi conversion is stable
  test('works on simple module', () => {
    const m = module.define({
      name: 'name',
      version: '0.0.0',
      functions: {
        toString: functions.define({
          input: types.number(),
          output: types.string(),
          error: types.never(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      module: m,
      version: 1,
      api: {
        functions: {
          toString: { method: 'get' },
        },
      },
    })

    expect(openapi).toEqual({
      openapi: '3.1.0',
      info: { version: '0.0.0', title: 'name' },
      servers: [{ url: '/name/api/v1' }],
      paths: {
        '/toString': {
          get: {
            parameters: [
              { name: 'input', in: 'query', required: true, explode: true, schema: { type: 'number' } },
              { name: 'projection', in: 'header', example: true },
            ],
            responses: {
              '200': { description: 'Success', content: { 'application/json': { schema: { type: 'string' } } } },
            },
            tags: [],
          },
        },
      },
      components: { schemas: {}, securitySchemes: { _: { type: 'http', scheme: 'bearer' } } },
    })
  })

  test('works on more complex module', () => {
    const postCategory = types.enumeration(['FUNNY', 'QUESTION']).setName('PostCategory')
    const user = () =>
      types.object({
        username: types.string(),
        posts: { virtual: types.array(post) },
        registeredAt: types.dateTime(),
      })
    const post = () =>
      types.object({
        title: types.string({ minLength: 1, maxLength: 2000 }),
        content: types.string(),
        author: { virtual: types.nullable(user) },
        likes: { virtual: types.array(user) },
        visualizations: types.integer({ minimum: 0 }),
        categories: types.array(postCategory).optional(),
      })
    const m = module.define({
      name: 'name',
      version: '0.0.0',
      functions: {
        getPosts: functions.define({
          input: types.object({ userId: types.string(), limit: types.integer().optional() }),
          output: types.array(post),
          error: types.never(),
        }),
        getUsers: functions.define({
          input: types.object({ start: types.integer(), limit: types.integer() }),
          output: types.array(user),
          error: types.never(),
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      module: m,
      version: 1,
      api: {
        functions: {
          getPosts: { method: 'get', path: '/posts/{userId}' },
          getUsers: [
            { method: 'post', path: '/users' },
            { method: 'get', path: '/users' },
          ],
        },
      },
    })

    expect(openapi).toEqual({
      openapi: '3.1.0',
      info: { version: '0.0.0', title: 'name' },
      servers: [{ url: '/name/api/v1' }],
      paths: {
        '/posts/{userId}': {
          get: {
            parameters: [
              { in: 'path', name: 'userId', required: true, schema: { type: 'string' } },
              { name: 'limit', in: 'query', required: false, explode: true, schema: { type: 'integer' } },
              { name: 'projection', in: 'header', example: true },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { type: 'array', items: { $ref: '#/components/schemas/ANONYMOUS_TYPE_0' } },
                  },
                },
              },
            },
            tags: [],
          },
        },
        '/users': {
          post: {
            parameters: [{ name: 'projection', in: 'header', example: true }],
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
                  'application/json': {
                    schema: { type: 'array', items: { $ref: '#/components/schemas/ANONYMOUS_TYPE_1' } },
                  },
                },
              },
            },
            tags: [],
          },
          get: {
            parameters: [
              { name: 'start', in: 'query', required: true, explode: true, schema: { type: 'integer' } },
              { name: 'limit', in: 'query', required: true, explode: true, schema: { type: 'integer' } },
              { name: 'projection', in: 'header', example: true },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { type: 'array', items: { $ref: '#/components/schemas/ANONYMOUS_TYPE_1' } },
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
          ANONYMOUS_TYPE_1: {
            type: 'object',
            required: ['username', 'registeredAt'],
            properties: {
              username: { type: 'string' },
              posts: { type: 'array', items: { $ref: '#/components/schemas/ANONYMOUS_TYPE_0' } },
              registeredAt: { type: 'string', format: 'date-time' },
            },
          },
          PostCategory: { type: 'string', enum: ['FUNNY', 'QUESTION'] },
          ANONYMOUS_TYPE_0: {
            type: 'object',
            required: ['title', 'content', 'visualizations'],
            properties: {
              title: { type: 'string', minLength: 1, maxLength: 2000 },
              content: { type: 'string' },
              author: { anyOf: [{ $ref: '#/components/schemas/ANONYMOUS_TYPE_1' }, { const: null }] },
              likes: { type: 'array', items: { $ref: '#/components/schemas/ANONYMOUS_TYPE_1' } },
              visualizations: { type: 'integer', minimum: 0 },
              categories: { type: 'array', items: { $ref: '#/components/schemas/PostCategory' } },
            },
          },
        },
        securitySchemes: { _: { type: 'http', scheme: 'bearer' } },
      },
    })
  })
})