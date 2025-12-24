import { functions, module, client as clientBuilder, middleware, security, exception, error } from '../src'
import { result, model } from '@mondrian-framework/model'
import { describe, expect, test, vi } from 'vitest'

describe('Middleware - checkMaxSelectionDepth', () => {
  test('should pass when depth is within limit', async () => {
    const type = () => model.entity({ value: model.string(), nested: model.optional(type) })
    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkMaxSelectionDepth(3) as any],
        body: async ({ input }) => {
          return result.ok({ value: input })
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

    const res = await client.functions.f('test', { retrieve: { select: { value: true } } })
    // Function without errors returns value directly
    expect(res).toEqual({ value: 'test' })
  })

  test('should throw when depth exceeds limit', async () => {
    const type = () => model.entity({ value: model.string(), nested: model.optional(type) })
    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkMaxSelectionDepth(2) as any],
        body: async ({ input }) => {
          return result.ok({ value: input })
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

    await expect(
      client.functions.f('test', {
        retrieve: { select: { nested: { select: { nested: { select: { value: true } } } } } },
      }),
    ).rejects.toThrow('Max selection depth reached')
  })
})

describe('Middleware - checkOutputType', () => {
  test('should pass with valid output', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.object({ name: model.string(), age: model.number() }),
      })
      .implement({
        middlewares: [middleware.checkOutputType('throw') as any],
        body: async ({ input }) => {
          return result.ok({ name: input, age: 25 })
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

    const res = await client.functions.f('John')
    expect(res).toEqual({ name: 'John', age: 25 })
  })

  test('should throw on invalid output when mode is throw', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.object({ name: model.string(), age: model.number() }),
      })
      .implement({
        middlewares: [middleware.checkOutputType('throw') as any],
        body: async ({ input }) => {
          return result.ok({ name: input, age: 'not a number' } as any)
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

    await expect(client.functions.f('John')).rejects.toThrow('Invalid output on function f')
  })

  test('should log on invalid output when mode is log', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.object({ name: model.string(), age: model.number() }),
      })
      .implement({
        middlewares: [middleware.checkOutputType('log') as any],
        body: async ({ input }) => {
          return result.ok({ name: input, age: 'not a number' } as any)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f },
      // Disable the module-level checkOutputType so the function-level one (log) takes effect
      options: { checkOutputType: 'ignore' },
    })

    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })

    // Should not throw, but return the original (invalid) value
    const res = await client.functions.f('John')
    expect(res).toEqual({ name: 'John', age: 'not a number' })
  })

  test('should handle failure results correctly', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
        errors: { notFound: model.literal('Not found') },
      })
      .implement({
        middlewares: [middleware.checkOutputType('throw') as any],
        body: async ({ input }) => {
          if (input === 'fail') {
            return result.fail({ notFound: 'Not found' })
          }
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

    const res = await client.functions.f('fail')
    expect(res.isFailure && res.error).toEqual({ notFound: 'Not found' })
  })

  test('should throw on unexpected failure result', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        middlewares: [middleware.checkOutputType('throw') as any],
        body: async () => {
          return result.fail({ unexpected: 'error' }) as any
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

    await expect(client.functions.f('test')).rejects.toThrow("It doesn't declare errors")
  })

  test('should handle retrieve with selection trimming', async () => {
    const type = model.entity({ name: model.string(), secret: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkOutputType('throw') as any],
        body: async ({ input }) => {
          return result.ok({ name: input, secret: 'hidden' })
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

    const res = await client.functions.f('John', { retrieve: { select: { name: true } } })
    // Function without errors returns value directly
    expect(res).toEqual({ name: 'John' })
  })
})

describe('Middleware - checkPolicies', () => {
  test('should pass when policies are satisfied', async () => {
    const type = () => model.entity({ id: model.number(), name: model.string(), secret: model.string() })
    const policies = security.on(type).allows({ selection: true })

    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkPolicies(() => policies) as any],
        body: async ({ input }) => {
          return result.ok({ id: 1, name: input, secret: 'secret' })
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

    const res = await client.functions.f('John', { retrieve: { select: { name: true } } })
    // Function without errors returns value directly
    expect(res).toEqual({ name: 'John' })
  })

  test('should skip policies when returning skip', async () => {
    const type = () => model.entity({ id: model.number(), name: model.string() })

    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkPolicies(() => 'skip') as any],
        body: async ({ input }) => {
          return result.ok({ id: 1, name: input })
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

    const res = await client.functions.f('John', { retrieve: { select: { id: true, name: true } } })
    // Function without errors returns value directly
    expect(res).toEqual({ id: 1, name: 'John' })
  })

  test('should throw on policy violation without error type', async () => {
    const type = () => model.entity({ id: model.number(), name: model.string(), secret: model.string() })
    const policies = security.on(type).allows({ selection: { name: true } })

    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkPolicies(() => policies) as any],
        body: async ({ input }) => {
          return result.ok({ id: 1, name: input, secret: 'secret' })
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

    await expect(client.functions.f('John', { retrieve: { select: { secret: true } } })).rejects.toThrow(
      'Unauthorized access.',
    )
  })

  test('should return error when policy violation with UnauthorizedAccess error type', async () => {
    const type = () => model.entity({ id: model.number(), name: model.string(), secret: model.string() })
    const policies = security.on(type).allows({ selection: { name: true } })

    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
        errors: { unauthorized: error.standard.UnauthorizedAccess },
      })
      .implement({
        middlewares: [middleware.checkPolicies(() => policies) as any],
        body: async ({ input }) => {
          return result.ok({ id: 1, name: input, secret: 'secret' })
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

    const res = await client.functions.f('John', { retrieve: { select: { secret: true } } })
    expect(res.isFailure).toBe(true)
    expect(res.isFailure && res.error.unauthorized).toBeDefined()
  })

  test('should apply mapper policies to result', async () => {
    const type = () => model.entity({ id: model.number(), name: model.string() })
    const policies = security
      .on(type)
      .allows({ selection: true })
      .map((u) => ({ ...u, name: '***' }))

    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [middleware.checkPolicies(() => policies) as any],
        body: async ({ input }) => {
          return result.ok({ id: 1, name: input })
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

    const res = await client.functions.f('John', { retrieve: { select: { id: true, name: true } } })
    // Function without errors returns value directly
    expect(res).toEqual({ id: 1, name: '***' })
  })

  test('should work with async policies function', async () => {
    const type = () => model.entity({ id: model.number(), name: model.string() })
    const policies = security.on(type).allows({ selection: true })

    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        middlewares: [
          middleware.checkPolicies(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return policies
          }) as any,
        ],
        body: async ({ input }) => {
          return result.ok({ id: 1, name: input })
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

    const res = await client.functions.f('John', { retrieve: { select: { name: true } } })
    // Function without errors returns value directly
    expect(res).toEqual({ name: 'John' })
  })
})

describe('Middleware chaining', () => {
  test('should execute middlewares in order', async () => {
    const executionOrder: string[] = []

    const middleware1: functions.Middleware<any, any, any, any, any, any> = {
      name: 'middleware1',
      apply: async (args, next) => {
        executionOrder.push('middleware1-before')
        const result = await next(args)
        executionOrder.push('middleware1-after')
        return result
      },
    }

    const middleware2: functions.Middleware<any, any, any, any, any, any> = {
      name: 'middleware2',
      apply: async (args, next) => {
        executionOrder.push('middleware2-before')
        const result = await next(args)
        executionOrder.push('middleware2-after')
        return result
      },
    }

    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        middlewares: [middleware1, middleware2],
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

    expect(executionOrder).toEqual([
      'middleware1-before',
      'middleware2-before',
      'body',
      'middleware2-after',
      'middleware1-after',
    ])
  })

  test('should allow middleware to modify args', async () => {
    const transformMiddleware: functions.Middleware<any, any, any, any, any, any> = {
      name: 'transform',
      apply: async (args, next) => {
        return next({ ...args, input: (args.input as any).toUpperCase() })
      },
    }

    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        middlewares: [transformMiddleware],
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

    const res = await client.functions.f('hello')
    expect(res).toBe('HELLO')
  })

  test('should allow middleware to short-circuit execution', async () => {
    const shortCircuitMiddleware: functions.Middleware<any, any, any, any, any, any> = {
      name: 'shortCircuit',
      apply: async (args, next) => {
        if ((args.input as any) === 'skip') {
          return result.ok('skipped') as any
        }
        return next(args)
      },
    }

    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        middlewares: [shortCircuitMiddleware],
        body: async ({ input }) => {
          return result.ok(`processed: ${input}`)
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

    const res1 = await client.functions.f('skip')
    expect(res1).toBe('skipped')

    const res2 = await client.functions.f('normal')
    expect(res2).toBe('processed: normal')
  })
})
