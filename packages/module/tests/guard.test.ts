import { guard, provider, functions, module, client as clientBuilder } from '../src'
import { result, model } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('Guard', () => {
  describe('build', () => {
    test('should create a simple guard without errors', async () => {
      const executed: string[] = []
      const simpleGuard = guard.build({
        async body(_: {}) {
          executed.push('guard-executed')
        },
      })

      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .use({ guards: { simple: simpleGuard } })
        .implement({
          body: async ({ input }) => {
            return result.ok(input)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return {}
        },
      })

      const res = await client.functions.f('test')
      expect(res).toBe('test')
      expect(executed).toContain('guard-executed')
    })

    test('should create a guard with errors that can fail', async () => {
      const authGuard = guard.build({
        errors: { unauthorized: model.string() },
        async body({ token }: { token: string }) {
          if (token !== 'valid-token') {
            return result.fail({ unauthorized: 'Invalid token' })
          }
        },
      })

      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
          errors: { unauthorized: model.string() },
        })
        .use({ guards: { auth: authGuard } })
        .implement({
          body: async ({ input }) => {
            return result.ok(input)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return { token: 'invalid-token' }
        },
      })

      const res = await client.functions.f('test')
      expect(res.isFailure && res.error).toEqual({ unauthorized: 'Invalid token' })
    })

    test('should pass when guard returns void', async () => {
      const authGuard = guard.build({
        errors: { unauthorized: model.string() },
        async body({ token }: { token: string }) {
          if (token !== 'valid-token') {
            return result.fail({ unauthorized: 'Invalid token' })
          }
          // Returns void when successful
        },
      })

      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
          errors: { unauthorized: model.string() },
        })
        .use({ guards: { auth: authGuard } })
        .implement({
          body: async ({ input }) => {
            return result.ok(input)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return { token: 'valid-token' }
        },
      })

      const res = await client.functions.f('test')
      expect(res.isOk && res.value).toBe('test')
    })
  })

  describe('use', () => {
    test('should create a guard with provider dependencies', async () => {
      const dbProvider = provider.build({
        async body() {
          return result.ok({ getUser: (id: string) => ({ id, name: 'John' }) })
        },
      })

      const authGuard = guard.use({ providers: { db: dbProvider } }).build({
        errors: { unauthorized: model.string() },
        async body({ userId }: { userId: string }, { db }) {
          const user = db.getUser(userId)
          if (!user) {
            return result.fail({ unauthorized: 'User not found' })
          }
        },
      })

      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
          errors: { unauthorized: model.string() },
        })
        .use({ guards: { auth: authGuard } })
        .implement({
          body: async ({ input }) => {
            return result.ok(input)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return { userId: '123' }
        },
      })

      const res = await client.functions.f('test')
      expect(res.isOk && res.value).toBe('test')
    })

    test('should chain multiple guards', async () => {
      const executionOrder: string[] = []

      const guard1 = guard.build({
        async body(_: {}) {
          executionOrder.push('guard1')
        },
      })

      const guard2 = guard.build({
        async body(_: {}) {
          executionOrder.push('guard2')
        },
      })

      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .use({ guards: { g1: guard1, g2: guard2 } })
        .implement({
          body: async ({ input }) => {
            executionOrder.push('body')
            return result.ok(input)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return {}
        },
      })

      await client.functions.f('test')
      expect(executionOrder).toEqual(['guard1', 'guard2', 'body'])
    })

    test('should stop execution if guard fails', async () => {
      const executionOrder: string[] = []

      const guard1 = guard.build({
        errors: { error1: model.string() },
        async body(_: {}) {
          executionOrder.push('guard1')
          return result.fail({ error1: 'Guard 1 failed' })
        },
      })

      const guard2 = guard.build({
        async body(_: {}) {
          executionOrder.push('guard2')
        },
      })

      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
          errors: { error1: model.string() },
        })
        .use({ guards: { g1: guard1, g2: guard2 } })
        .implement({
          body: async ({ input }) => {
            executionOrder.push('body')
            return result.ok(input)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return {}
        },
      })

      const res = await client.functions.f('test')
      expect(res.isFailure && res.error).toEqual({ error1: 'Guard 1 failed' })
      expect(executionOrder).toEqual(['guard1']) // guard2 and body not executed
    })
  })
})

describe('Guard with providers accessing tracer', () => {
  test('should have access to tracer in guard body', async () => {
    let tracerReceived = false

    const testGuard = guard.build({
      async body(_: {}, { tracer }) {
        tracerReceived = tracer !== undefined
      },
    })

    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .use({ guards: { test: testGuard } })
      .implement({
        body: async ({ input }) => {
          return result.ok(input)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f },
    })

    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })

    await client.functions.f('test')
    expect(tracerReceived).toBe(true)
  })
})
