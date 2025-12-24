import { cron, start } from '../src'
import { build, define } from '../src/api'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Helper function to create test functions
function createTestFunctions() {
  const f1 = functions
    .define({
      output: model.number(),
    })
    .implement({
      async body() {
        return result.ok(1)
      },
    })

  const f2 = functions
    .define({
      input: model.number(),
      output: model.number(),
    })
    .implement({
      async body({ input }) {
        return result.ok(input + 1)
      },
    })

  const f3 = functions
    .define({
      input: model.number().optional(),
      output: model.number(),
    })
    .implement({
      async body({ input }) {
        return result.ok(input ?? 1 + 1)
      },
    })

  const f4 = functions
    .define({
      input: model.string(),
      output: model.string(),
    })
    .implement({
      async body({ input }) {
        return result.ok(input.toUpperCase())
      },
    })

  return { f1, f2, f3, f4 }
}

function createTestModule(funcs: ReturnType<typeof createTestFunctions>) {
  return module.build({
    name: 'test',
    functions: funcs,
    async context() {
      return result.ok({})
    },
  })
}

describe('cron API', () => {
  describe('define', () => {
    test('should define API specification with valid cron strings', () => {
      const { f1, f2, f3 } = createTestFunctions()
      const m = createTestModule({ f1, f2, f3, f4: createTestFunctions().f4 })

      const apiSpec = define({
        module: m,
        functions: {
          f1: {
            cron: '* * * * *',
          },
          f2: {
            cron: '0 0 * * *',
            async input() {
              return 1
            },
          },
        },
      })

      expect(apiSpec).toBeDefined()
      expect(apiSpec.functions.f1?.cron).toBe('* * * * *')
      expect(apiSpec.functions.f2?.cron).toBe('0 0 * * *')
    })

    test('should define API specification with array of cron specifications', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      const apiSpec = define({
        module: m,
        functions: {
          f1: [{ cron: '* * * * *' }, { cron: '0 0 * * *' }, { cron: '0 12 * * *', runAtStart: true }] as any,
        },
      })

      expect(apiSpec).toBeDefined()
      expect(Array.isArray(apiSpec.functions.f1)).toBe(true)
    })

    test('should throw error for empty cron string in array specification', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      expect(() =>
        define({
          module: m,
          functions: {
            f1: [{ cron: '* * * * *' }, { cron: '' }] as any,
          },
        }),
      ).toThrow("Invalid cron specification for function f1. A non-empty 'cron' string is required.")
    })

    test('should throw error for empty cron string', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      expect(() =>
        define({
          module: m,
          functions: {
            f1: {
              cron: '',
            },
          },
        }),
      ).toThrow("Invalid cron specification for function f1. A non-empty 'cron' string is required.")
    })

    test('should throw error for missing cron string', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      expect(() =>
        define({
          module: m,
          functions: {
            f1: {} as any,
          },
        }),
      ).toThrow("Invalid cron specification for function f1. A non-empty 'cron' string is required.")
    })

    test('should handle undefined specification values', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      expect(() =>
        define({
          module: m,
          functions: {
            f1: undefined as any,
          },
        }),
      ).toThrow("Invalid cron specification for function f1. A non-empty 'cron' string is required.")
    })
  })

  describe('build', () => {
    test('should build API with module and function specifications', () => {
      const { f1, f2, f3, f4 } = createTestFunctions()
      const m = createTestModule({ f1, f2, f3, f4 })

      const cronApi = build({
        module: m,
        functions: {
          f1: {
            cron: '* * * * *',
          },
          f2: {
            cron: '*/5 * * * *',
            async input() {
              return 42
            },
          },
          f3: {
            cron: '0 0 * * *',
          },
        },
      })

      expect(cronApi).toBeDefined()
      expect(cronApi.module).toBe(m)
      expect(cronApi.functions.f1?.cron).toBe('* * * * *')
      expect(cronApi.functions.f2?.cron).toBe('*/5 * * * *')
      expect(cronApi.functions.f3?.cron).toBe('0 0 * * *')
    })

    test('should build API with timezone option', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      const cronApi = build({
        module: m,
        functions: {
          f1: {
            cron: '0 9 * * *',
            timezone: 'America/New_York',
          },
        },
      })

      expect(cronApi.functions.f1?.timezone).toBe('America/New_York')
    })

    test('should build API with runAtStart option', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      const cronApi = build({
        module: m,
        functions: {
          f1: {
            cron: '0 * * * *',
            runAtStart: true,
          },
        },
      })

      expect(cronApi.functions.f1?.runAtStart).toBe(true)
    })

    test('should throw error for empty cron string in build', () => {
      const { f1 } = createTestFunctions()
      const m = module.build({
        name: 'test',
        functions: { f1 },
        async context() {
          return result.ok({})
        },
      })

      expect(() =>
        build({
          module: m,
          functions: {
            f1: {
              cron: '',
            },
          },
        }),
      ).toThrow("Invalid cron specification for function f1. A non-empty 'cron' string is required.")
    })
  })
})

describe('cron executor (start)', () => {
  test('should start and close cron server successfully', async () => {
    const { f1, f2, f3, f4 } = createTestFunctions()
    const m = createTestModule({ f1, f2, f3, f4 })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '* * * * *',
        },
        f2: {
          cron: '* * * * *',
          async input() {
            return 1
          },
        },
        f3: {
          cron: '* * * * *',
        },
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })
    expect(cronServer).toBeDefined()
    expect(cronServer.close).toBeDefined()
    await cronServer.close()
  })

  test('should handle functions not in specification', async () => {
    const { f1, f2, f3, f4 } = createTestFunctions()
    const m = createTestModule({ f1, f2, f3, f4 })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '* * * * *',
        },
        // f2, f3, f4 are not specified
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })
    await cronServer.close()
  })

  test('should throw error for invalid cron string', () => {
    const { f1 } = createTestFunctions()
    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '* * * * *',
        },
      },
    })

    // Manually set an invalid cron string after build to test executor validation
    ;(cronApi.functions.f1 as any).cron = 'invalid-cron'

    expect(() => start({ api: cronApi, context: async () => ({}) })).toThrow('Invalid cron string invalid-cron')
  })

  test('should handle runAtStart option', async () => {
    const executionCount = { value: 0 }

    const f1 = functions
      .define({
        output: model.number(),
      })
      .implement({
        async body() {
          executionCount.value++
          return result.ok(executionCount.value)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *', // Very infrequent - once a year
          runAtStart: true,
        },
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })

    // Give some time for the runAtStart execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(executionCount.value).toBeGreaterThanOrEqual(1)
    await cronServer.close()
  })

  test('should handle timezone option', async () => {
    const { f1 } = createTestFunctions()
    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 * * *',
          timezone: 'Europe/London',
        },
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })
    expect(cronServer).toBeDefined()
    await cronServer.close()
  })

  test('should handle input generator function', async () => {
    let generatedInput: number | undefined

    const f1 = functions
      .define({
        input: model.number(),
        output: model.number(),
      })
      .implement({
        async body({ input }) {
          generatedInput = input
          return result.ok(input * 2)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *',
          runAtStart: true,
          async input() {
            return 42
          },
        },
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })

    // Wait for execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(generatedInput).toBe(42)
    await cronServer.close()
  })

  test('should handle optional input without input generator', async () => {
    let receivedInput: number | undefined

    const f1 = functions
      .define({
        input: model.number().optional(),
        output: model.number(),
      })
      .implement({
        async body({ input }) {
          receivedInput = input
          return result.ok(input ?? 0)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *',
          runAtStart: true,
          // No input generator provided for optional input
        },
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })

    // Wait for execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(receivedInput).toBeUndefined()
    await cronServer.close()
  })

  test('should handle context function', async () => {
    let contextCron: string | undefined

    const f1 = functions
      .define({
        output: model.number(),
      })
      .implement({
        async body() {
          return result.ok(1)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *',
          runAtStart: true,
        },
      },
    })

    const cronServer = start({
      api: cronApi,
      context: async ({ cron: cronStr }) => {
        contextCron = cronStr
        return {}
      },
    })

    // Wait for execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(contextCron).toBe('0 0 1 1 *')
    await cronServer.close()
  })

  test('should handle function execution error gracefully', async () => {
    const f1 = functions
      .define({
        output: model.number(),
      })
      .implement({
        async body() {
          throw new Error('Test error')
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *',
          runAtStart: true,
        },
      },
    })

    // Should not throw - error is handled internally
    const cronServer = start({ api: cronApi, context: async () => ({}) })

    // Wait for execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    await cronServer.close()
  })

  test('should handle non-Error exception gracefully', async () => {
    const f1 = functions
      .define({
        output: model.number(),
      })
      .implement({
        async body() {
          throw 'String error' // Non-Error exception
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *',
          runAtStart: true,
        },
      },
    })

    // Should not throw - error is handled internally
    const cronServer = start({ api: cronApi, context: async () => ({}) })

    // Wait for execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    await cronServer.close()
  })

  test('should handle invalid input type from generator', async () => {
    const f1 = functions
      .define({
        input: model.number(),
        output: model.number(),
      })
      .implement({
        async body({ input }) {
          return result.ok(input * 2)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '0 0 1 1 *',
          runAtStart: true,
          async input() {
            return 'not a number' as any // Invalid input type
          },
        },
      },
    })

    // The error is thrown when input validation fails
    // We need to catch the unhandled rejection
    const originalHandler = process.listeners('unhandledRejection')
    let caughtError: Error | undefined

    const errorHandler = (error: Error) => {
      caughtError = error
    }
    process.removeAllListeners('unhandledRejection')
    process.on('unhandledRejection', errorHandler)

    const cronServer = start({ api: cronApi, context: async () => ({}) })

    // Wait for execution
    await new Promise((resolve) => setTimeout(resolve, 150))

    await cronServer.close()

    // Restore original handlers
    process.removeAllListeners('unhandledRejection')
    for (const handler of originalHandler) {
      process.on('unhandledRejection', handler as any)
    }

    // Verify the error was thrown with correct message
    expect(caughtError).toBeDefined()
    expect(caughtError?.message).toContain('Invalid input generated by cron schedule of function f1')
  })
})

describe('cron module exports', () => {
  test('should export cron namespace with build and define', () => {
    expect(cron).toBeDefined()
    expect(cron.build).toBeDefined()
    expect(cron.define).toBeDefined()
    expect(typeof cron.build).toBe('function')
    expect(typeof cron.define).toBe('function')
  })

  test('should export start function', () => {
    expect(start).toBeDefined()
    expect(typeof start).toBe('function')
  })
})

describe('cron schedule patterns', () => {
  test('should accept various valid cron patterns', async () => {
    const { f1 } = createTestFunctions()
    const m = module.build({
      name: 'test',
      functions: { f1 },
      async context() {
        return result.ok({})
      },
    })

    const patterns = [
      '* * * * *', // Every minute
      '*/5 * * * *', // Every 5 minutes
      '0 * * * *', // Every hour
      '0 0 * * *', // Every day at midnight
      '0 0 * * 0', // Every Sunday at midnight
      '0 0 1 * *', // First day of every month
      '30 4 1,15 * 5', // Complex pattern
    ]

    for (const pattern of patterns) {
      const cronApi = build({
        module: m,
        functions: {
          f1: {
            cron: pattern,
          },
        },
      })

      const cronServer = start({ api: cronApi, context: async () => ({}) })
      expect(cronServer).toBeDefined()
      await cronServer.close()
    }
  })

  test('should handle multiple functions with different schedules', async () => {
    const { f1, f2, f3, f4 } = createTestFunctions()
    const m = createTestModule({ f1, f2, f3, f4 })

    const cronApi = build({
      module: m,
      functions: {
        f1: {
          cron: '* * * * *',
        },
        f2: {
          cron: '*/5 * * * *',
          async input() {
            return 1
          },
        },
        f3: {
          cron: '0 * * * *',
        },
        f4: {
          cron: '0 0 * * *',
          async input() {
            return 'test'
          },
        },
      },
    })

    const cronServer = start({ api: cronApi, context: async () => ({}) })
    expect(cronServer).toBeDefined()
    await cronServer.close()
  })
})
