import { functions, module, client as clientBuilder, provider, error } from '../src'
import { result, model } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('Client', () => {
  describe('withMetadata', () => {
    test('should create client with initial metadata', async () => {
      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => result.ok(input),
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      let receivedMetadata: { token?: string } | undefined

      const client = clientBuilder.withMetadata<{ token?: string }>({ token: 'initial' }).build({
        module: m,
        async context({ metadata }) {
          receivedMetadata = metadata
          return {}
        },
      })

      await client.functions.f('test')
      expect(receivedMetadata?.token).toBe('initial')
    })

    test('should allow overriding metadata per request', async () => {
      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => result.ok(input),
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const metadataHistory: Array<{ token?: string } | undefined> = []

      const client = clientBuilder.withMetadata<{ token?: string }>({ token: 'initial' }).build({
        module: m,
        async context({ metadata }) {
          metadataHistory.push(metadata)
          return {}
        },
      })

      await client.functions.f('test')
      await client.functions.f('test', { metadata: { token: 'override' } })
      await client.functions.f('test')

      expect(metadataHistory[0]?.token).toBe('initial')
      expect(metadataHistory[1]?.token).toBe('override')
      expect(metadataHistory[2]?.token).toBe('initial')
    })

    test('should chain withMetadata calls', async () => {
      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => result.ok(input),
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      let receivedMetadata: { token?: string; userId?: string } | undefined

      const client = clientBuilder.withMetadata<{ token?: string; userId?: string }>().build({
        module: m,
        async context({ metadata }) {
          receivedMetadata = metadata
          return {}
        },
      })

      const clientWithToken = client.withMetadata({ token: 'abc' })
      await clientWithToken.functions.f('test')

      expect(receivedMetadata?.token).toBe('abc')
    })
  })

  describe('build', () => {
    test('should work without explicit metadata', async () => {
      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => result.ok(input),
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
      expect(res).toBe('hello')
    })
  })

  describe('functions with undefined input', () => {
    test('should handle function with undefined input', async () => {
      const f = functions
        .define({
          output: model.string(),
        })
        .implement({
          body: async () => result.ok('no input needed'),
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

      const res = await client.functions.f()
      expect(res).toBe('no input needed')
    })

    test('should allow options without input for undefined input functions', async () => {
      const type = model.entity({ id: model.number(), name: model.string() })
      const f = functions
        .define({
          output: type,
          retrieve: { select: true },
        })
        .implement({
          body: async () => result.ok({ id: 1, name: 'John' }),
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

      // When there are no errors, the client returns the value directly (not wrapped in Result)
      const res = await client.functions.f({ retrieve: { select: { name: true } } })
      expect(res).toEqual({ name: 'John' })
    })
  })

  describe('error handling', () => {
    test('should propagate exceptions from context function', async () => {
      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => result.ok(input),
        })

      const m = module.build({
        name: 'test',
        functions: { f },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          throw new Error('Context error')
        },
      })

      await expect(client.functions.f('test')).rejects.toThrow('Context error')
    })

    test('should propagate exceptions from function body', async () => {
      const f = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          body: async () => {
            throw new Error('Function error')
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

      await expect(client.functions.f('test')).rejects.toThrow('Function error')
    })
  })

  describe('rawApply with decodingOptions', () => {
    test('should use module preferredDecodingOptions', async () => {
      const f = functions
        .define({
          input: model.object({ name: model.string() }),
          output: model.string(),
        })
        .implement({
          body: async ({ input }) => result.ok(input.name),
        })

      const m = module.build({
        name: 'test',
        functions: { f },
        options: {
          preferredDecodingOptions: {
            fieldStrictness: 'allowAdditionalFields',
          },
        },
      })

      const client = clientBuilder.build({
        module: m,
        async context() {
          return {}
        },
      })

      // With allowAdditionalFields, extra fields should be ignored
      const res = await client.functions.f({ name: 'John', extra: 'field' } as any)
      expect(res).toBe('John')
    })
  })

  describe('with BadInput error', () => {
    test('should return BadInput error on invalid input', async () => {
      const f = functions
        .define({
          input: model.object({ name: model.string(), age: model.number() }),
          output: model.string(),
          errors: { badInput: error.standard.BadInput },
        })
        .implement({
          body: async ({ input }) => result.ok(input.name),
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

      const res = await client.functions.f({ name: 'John', age: 'not a number' } as any)
      expect(res.isFailure).toBe(true)
      expect(res.isFailure && res.error.badInput?.from).toBe('input')
    })

    test('should return BadInput error on invalid retrieve', async () => {
      const type = model.entity({ id: model.number(), name: model.string() })
      const f = functions
        .define({
          input: model.string(),
          output: type,
          retrieve: { select: true, take: true },
          errors: { badInput: error.standard.BadInput },
        })
        .implement({
          body: async ({ input }) => result.ok({ id: 1, name: input }),
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

      const res = await client.functions.f('test', { retrieve: { take: 'not a number' } as any })
      expect(res.isFailure).toBe(true)
      expect(res.isFailure && res.error.badInput?.from).toBe('retrieve')
    })
  })
})

describe('Module options', () => {
  test('should apply maxSelectionDepth from module options', async () => {
    const type = () => model.entity({ value: model.string(), nested: model.optional(type) })
    const f = functions
      .define({
        input: model.string(),
        output: type,
        retrieve: { select: true },
      })
      .implement({
        body: async ({ input }) => result.ok({ value: input }),
      })

    const m = module.build({
      name: 'test',
      functions: { f },
      options: {
        maxSelectionDepth: 2,
      },
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

  test('should apply resolveNestedPromises option', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.object({ name: model.string(), computed: model.number() }),
      })
      .implement({
        body: async ({ input }) => {
          return result.ok({
            name: input,
            computed: Promise.resolve(42) as unknown as number,
          })
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f },
      options: {
        resolveNestedPromises: true,
      },
    })

    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })

    const res = await client.functions.f('John')
    expect(res).toEqual({ name: 'John', computed: 42 })
  })

  test('should handle TotalCountArray with resolveNestedPromises', async () => {
    const f = functions
      .define({
        input: model.string(),
        output: model.object({ value: model.string() }).array(),
      })
      .implement({
        body: async () => {
          const arr = new model.TotalCountArray(10, [{ value: Promise.resolve('a') as unknown as string }])
          return result.ok(arr)
        },
      })

    const m = module.build({
      name: 'test',
      functions: { f },
      options: {
        resolveNestedPromises: true,
      },
    })

    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })

    const res = await client.functions.f('test')
    expect(res).toEqual([{ value: 'a' }])
    // Note: TotalCountArray is converted to a regular array after resolving promises
    // The totalCount property may not be preserved through the resolution process
  })
})
