import { build, define } from '../src/api'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'

describe('api', () => {
  const User = () =>
    model.entity({
      id: model.string(),
      name: model.string(),
    })

  const testModuleInterface = module.define({
    name: 'test-module',
    functions: {
      getUser: functions.define({
        input: model.string(),
        output: User,
      }),
      createUser: functions.define({
        input: model.object({ name: model.string() }),
        output: User,
      }),
    },
  })

  describe('define', () => {
    test('creates an API specification without implementation', () => {
      const api = define({
        module: testModuleInterface,
        functions: {
          getUser: { type: 'query' },
          createUser: { type: 'mutation' },
        },
      })

      expect(api.module).toBe(testModuleInterface)
      expect(api.functions.getUser).toEqual({ type: 'query' })
      expect(api.functions.createUser).toEqual({ type: 'mutation' })
    })

    test('creates API specification with options', () => {
      const api = define({
        module: testModuleInterface,
        functions: {
          getUser: { type: 'query', name: 'fetchUser' },
        },
        options: {
          path: '/graphql',
        },
      })

      expect(api.options?.path).toBe('/graphql')
      expect((api.functions.getUser as any).name).toBe('fetchUser')
    })

    test('creates API specification with multiple specifications per function', () => {
      const api = define({
        module: testModuleInterface,
        functions: {
          getUser: [
            { type: 'query', name: 'getUser' },
            { type: 'query', name: 'fetchUser' },
          ],
        },
      })

      expect(api.functions.getUser).toHaveLength(2)
    })

    test('creates API specification with empty functions', () => {
      const api = define({
        module: testModuleInterface,
        functions: {},
      })

      expect(api.functions).toEqual({})
    })
  })

  describe('build', () => {
    test('creates an API with module implementation', () => {
      const impl = module.build({
        ...testModuleInterface,
        functions: {
          getUser: functions
            .define({
              input: model.string(),
              output: User,
            })
            .implement({
              async body({ input }) {
                return result.ok({ id: input, name: 'Test User' })
              },
            }),
          createUser: functions
            .define({
              input: model.object({ name: model.string() }),
              output: User,
            })
            .implement({
              async body({ input }) {
                return result.ok({ id: '1', name: input.name })
              },
            }),
        },
      })

      const api = build({
        module: impl,
        functions: {
          getUser: { type: 'query' },
          createUser: { type: 'mutation' },
        },
      })

      expect(api.module).toBe(impl)
      expect(api.module.name).toBe('test-module')
    })

    test('builds API with custom operation names', () => {
      const impl = module.build({
        ...testModuleInterface,
        functions: {
          getUser: functions
            .define({
              input: model.string(),
              output: User,
            })
            .implement({
              async body({ input }) {
                return result.ok({ id: input, name: 'Test User' })
              },
            }),
          createUser: functions
            .define({
              input: model.object({ name: model.string() }),
              output: User,
            })
            .implement({
              async body({ input }) {
                return result.ok({ id: '1', name: input.name })
              },
            }),
        },
      })

      const api = build({
        module: impl,
        functions: {
          getUser: { type: 'query', name: 'fetchUserById', inputName: 'userId' },
        },
      })

      expect((api.functions.getUser as any).name).toBe('fetchUserById')
      expect((api.functions.getUser as any).inputName).toBe('userId')
    })

    test('builds API with function having errors', () => {
      const impl = module.build({
        name: 'error-test',
        functions: {
          riskyOperation: functions
            .define({
              input: model.string(),
              output: model.string(),
              errors: {
                notFound: model.string(),
                forbidden: model.object({ reason: model.string() }),
              },
            })
            .implement({
              async body({ input }) {
                if (input === 'not-found') {
                  return result.fail({ notFound: 'Resource not found' })
                }
                if (input === 'forbidden') {
                  return result.fail({ forbidden: { reason: 'Access denied' } })
                }
                return result.ok(input)
              },
            }),
        },
      })

      const api = build({
        module: impl,
        functions: {
          riskyOperation: { type: 'mutation' },
        },
      })

      expect(api.module.functions.riskyOperation).toBeDefined()
    })
  })
})
