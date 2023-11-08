import { rest } from '../src'
import { model } from '@mondrian-framework/model'
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
          input: model.number(),
          output: model.string(),
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
      version: '0.0.0',
      functions: {
        getPosts: functions.define({
          input: model.object({ userId: model.string(), limit: model.integer().optional() }),
          output: model.array(post),
          errors: undefined,
          retrieve: undefined,
        }),
        getUsers: functions.define({
          input: model.object({ start: model.integer(), limit: model.integer() }),
          output: model.array(user),
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
      },
      components: {
        schemas: {
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
              author: { anyOf: [{ $ref: '#/components/schemas/user' }, { const: null }] },
              likes: { type: 'array', items: { $ref: '#/components/schemas/user' } },
              visualizations: { type: 'integer', minimum: 0 },
              categories: { type: 'array', items: { $ref: '#/components/schemas/PostCategory' } },
            },
          },
        },
      },
    })
  })
})
