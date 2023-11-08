import { rest } from '../src'
import { types } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'

describe('module to openapi', () => {
  //TODO [Good first issue]: add more tests
  test('works on simple module', () => {
    const m = module.define({
      name: 'name',
      version: '0.0.0',
      functions: {
        toString: functions.define({
          input: types.number(),
          output: types.string(),
          errors: undefined,
          retrieve: undefined,
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      module: m,
      version: 1,
      api: {
        version: 1,
        functions: {
          toString: { method: 'get' },
        },
      },
    })

    expect(openapi).toEqual({
      openapi: '3.1.0',
      info: { version: '0.0.0', title: 'name' },
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

  test('works on more complex module', () => {
    const postCategory = types.enumeration(['FUNNY', 'QUESTION']).setName('PostCategory')
    const user = () =>
      types.entity({
        username: types.string(),
        posts: types.array(post),
        registeredAt: types.datetime(),
      })
    const post = () =>
      types.entity({
        title: types.string({ minLength: 1, maxLength: 2000 }),
        content: types.string(),
        author: types.nullable(user),
        likes: types.array(user),
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
          errors: undefined,
          retrieve: undefined,
        }),
        getUsers: functions.define({
          input: types.object({ start: types.integer(), limit: types.integer() }),
          output: types.array(user),
          errors: undefined,
          retrieve: undefined,
        }),
      },
    })

    const openapi = rest.openapi.fromModule({
      module: m,
      version: 1,
      api: {
        version: 1,
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
      servers: [{ url: '/api/v1' }],
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
      },
    })
  })
})
