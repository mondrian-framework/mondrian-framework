import { rateLimiter, Rate, Store } from '../src'
import { InMemoryStore } from '../src/implementation/in-memory'
import { buildGuard, buildProvider } from '../src/provider'
import { result, model } from '@mondrian-framework/model'
import { module, functions, client as clientBuilder, provider } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'

describe('buildGuard', () => {
  describe('with Rate literal', () => {
    test('allows requests under rate limit', async () => {
      const guard = rateLimiter.buildGuard({
        errors: { tooManyRequests: model.string() },
        key: ({ userId }: { userId: string }) => userId,
        rate: '10 requests in 1 minute',
        onLimit: () => ({ tooManyRequests: 'Rate limited' }),
      })

      expect(guard).toBeDefined()
    })

    test('returns null key to bypass rate limiting', async () => {
      const guard = rateLimiter.buildGuard({
        errors: { tooManyRequests: model.string() },
        key: ({ bypass }: { bypass: boolean }) => (bypass ? null : 'user-1'),
        rate: '1 request in 1 minute',
        onLimit: () => ({ tooManyRequests: 'Rate limited' }),
      })

      expect(guard).toBeDefined()
    })
  })

  describe('with Rate object', () => {
    test('accepts Rate instance', async () => {
      const guard = rateLimiter.buildGuard({
        errors: { tooManyRequests: model.string() },
        key: ({ ip }: { ip: string }) => ip,
        rate: new Rate({ requests: 5, period: 30, scale: 'second' }),
        onLimit: () => ({ tooManyRequests: 'Too many requests' }),
      })

      expect(guard).toBeDefined()
    })
  })

  describe('with custom store', () => {
    test('uses provided store', async () => {
      const store = new InMemoryStore()
      const guard = rateLimiter.buildGuard({
        errors: { tooManyRequests: model.string() },
        key: ({ userId }: { userId: string }) => userId,
        rate: '5 requests in 1 minute',
        onLimit: () => ({ tooManyRequests: 'Rate limited' }),
        store,
      })

      expect(guard).toBeDefined()
    })
  })

  describe('integration with module', () => {
    test('rate limits function calls', async () => {
      const rateLimitGuard = rateLimiter.buildGuard({
        errors: { tooManyRequests: model.string() },
        key: ({ userId }: { userId: string }) => userId,
        rate: '2 requests in 1 minute',
        onLimit: () => ({ tooManyRequests: 'Too many requests' }),
      })

      const greet = functions
        .define({
          input: model.object({ name: model.string() }),
          output: model.string(),
          errors: { tooManyRequests: model.string() },
        })
        .use({ providers: { guard: rateLimitGuard } })
        .implement({
          body: async ({ input }) => {
            return result.ok(`Hello, ${input.name}!`)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { greet },
      })

      const client = clientBuilder.withMetadata<{ userId: string }>().build({
        module: m,
        context: async ({ metadata }) => {
          return { userId: metadata?.userId ?? 'anonymous' }
        },
      })

      // First request should succeed
      const result1 = await client.functions.greet({ name: 'World' }, { metadata: { userId: 'user-1' } })
      expect(result1.isOk).toBe(true)

      // Second request should succeed
      const result2 = await client.functions.greet({ name: 'World' }, { metadata: { userId: 'user-1' } })
      expect(result2.isOk).toBe(true)

      // Third request should be rate limited
      const result3 = await client.functions.greet({ name: 'World' }, { metadata: { userId: 'user-1' } })
      expect(result3.isOk).toBe(false)
      expect(result3.isFailure && result3.error).toEqual({ tooManyRequests: 'Too many requests' })
    })

    test('allows bypass when key returns null', async () => {
      const rateLimitGuard = rateLimiter.buildGuard({
        errors: { tooManyRequests: model.string() },
        key: ({ isAdmin }: { isAdmin: boolean }) => (isAdmin ? null : 'user'),
        rate: '1 request in 1 minute',
        onLimit: () => ({ tooManyRequests: 'Too many requests' }),
      })

      const action = functions
        .define({
          input: model.object({ data: model.string() }),
          output: model.string(),
          errors: { tooManyRequests: model.string() },
        })
        .use({ guards: { rateLimitGuard } })
        .implement({
          body: async ({ input }) => {
            return result.ok(`Processed: ${input.data}`)
          },
        })

      const m = module.build({
        name: 'test',
        functions: { action },
      })

      const client = clientBuilder.withMetadata<{ isAdmin?: boolean }>().build({
        module: m,
        context: async ({ metadata }) => {
          return { isAdmin: metadata?.isAdmin ?? false }
        },
      })

      // Admin requests bypass rate limiting - metadata should be passed in options
      for (let i = 0; i < 5; i++) {
        const res = await client.functions.action({ data: 'test' }, { metadata: { isAdmin: true } })
        expect(res.isOk).toBe(true)
      }
    })
  })
})

describe('buildProvider', () => {
  describe('with Rate literal', () => {
    test('creates provider with rate literal', () => {
      const provider = rateLimiter.buildProvider({
        rate: '10 requests in 1 minute',
      })

      expect(provider).toBeDefined()
    })
  })

  describe('with Rate object', () => {
    test('creates provider with Rate instance', () => {
      const provider = rateLimiter.buildProvider({
        rate: new Rate({ requests: 100, period: 1, scale: 'hour' }),
      })

      expect(provider).toBeDefined()
    })
  })

  describe('with custom store', () => {
    test('uses provided store', () => {
      const store = new InMemoryStore()
      const provider = rateLimiter.buildProvider({
        rate: '5 requests in 30 seconds',
        store,
      })

      expect(provider).toBeDefined()
    })
  })

  describe('apply method', () => {
    test('allows requests under rate limit', async () => {
      const rateLimitProvider = rateLimiter.buildProvider({
        rate: '3 requests in 1 minute',
      })

      const action = functions
        .define({
          input: model.object({ key: model.string() }),
          output: model.string(),
          errors: { rateLimited: model.string() },
        })
        .use({ providers: { rateLimiter: rateLimitProvider } })
        .implement({
          body: async ({ input, rateLimiter }) => {
            if (rateLimiter.apply(input.key) === 'rate-limited') {
              return result.fail({ rateLimited: 'Too many requests' })
            }
            return result.ok('Success')
          },
        })

      const m = module.build({
        name: 'test',
        functions: { action },
      })

      const client = clientBuilder.build({
        module: m,
        context: async () => ({}),
      })

      // First three requests should succeed
      expect((await client.functions.action({ key: 'user-1' })).isOk).toBe(true)
      expect((await client.functions.action({ key: 'user-1' })).isOk).toBe(true)
      expect((await client.functions.action({ key: 'user-1' })).isOk).toBe(true)

      // Fourth request should be rate limited
      const result4 = await client.functions.action({ key: 'user-1' })
      expect(result4.isOk).toBe(false)
      expect(result4.isFailure && result4.error).toEqual({ rateLimited: 'Too many requests' })
    })

    test('rate limits different keys independently', async () => {
      const rateLimitProvider = rateLimiter.buildProvider({
        rate: '2 requests in 1 minute',
      })

      const action = functions
        .define({
          input: model.object({ userId: model.string() }),
          output: model.string(),
          errors: { rateLimited: model.string() },
        })
        .use({ providers: { rateLimiter: rateLimitProvider } })
        .implement({
          body: async ({ input, rateLimiter }) => {
            if (rateLimiter.apply(input.userId) === 'rate-limited') {
              return result.fail({ rateLimited: 'Too many requests' })
            }
            return result.ok('Success')
          },
        })

      const m = module.build({
        name: 'test',
        functions: { action },
      })

      const client = clientBuilder.build({
        module: m,
        context: async () => ({}),
      })

      // User 1 makes 2 requests
      expect((await client.functions.action({ userId: 'user-1' })).isOk).toBe(true)
      expect((await client.functions.action({ userId: 'user-1' })).isOk).toBe(true)

      // User 1 is rate limited
      expect((await client.functions.action({ userId: 'user-1' })).isOk).toBe(false)

      // User 2 should still be allowed
      expect((await client.functions.action({ userId: 'user-2' })).isOk).toBe(true)
      expect((await client.functions.action({ userId: 'user-2' })).isOk).toBe(true)
    })
  })

  describe('check method', () => {
    test('checks rate limit without incrementing', async () => {
      const rateLimitProvider = rateLimiter.buildProvider({
        rate: '2 requests in 1 minute',
      })

      const action = functions
        .define({
          input: model.object({ key: model.string(), checkOnly: model.boolean() }),
          output: model.string(),
          errors: { rateLimited: model.string() },
        })
        .use({ providers: { rateLimiter: rateLimitProvider } })
        .implement({
          body: async ({ input, rateLimiter }) => {
            if (input.checkOnly) {
              const status = rateLimiter.check(input.key)
              return result.ok(status)
            }
            if (rateLimiter.apply(input.key) === 'rate-limited') {
              return result.fail({ rateLimited: 'Too many requests' })
            }
            return result.ok('Success')
          },
        })

      const m = module.build({
        name: 'test',
        functions: { action },
      })

      const client = clientBuilder.build({
        module: m,
        context: async () => ({}),
      })

      // Check without incrementing - should be allowed
      const checkResult1 = await client.functions.action({ key: 'user-1', checkOnly: true })
      expect(checkResult1.isOk && checkResult1.value).toBe('allowed')

      // Make 2 actual requests
      expect((await client.functions.action({ key: 'user-1', checkOnly: false })).isOk).toBe(true)
      expect((await client.functions.action({ key: 'user-1', checkOnly: false })).isOk).toBe(true)

      // Check should now show rate-limited
      const checkResult2 = await client.functions.action({ key: 'user-1', checkOnly: true })
      expect(checkResult2.isOk && checkResult2.value).toBe('rate-limited')

      // And apply should also be rate-limited
      const applyResult = await client.functions.action({ key: 'user-1', checkOnly: false })
      expect(applyResult.isOk).toBe(false)
    })
  })
})

describe('exports', () => {
  test('rateLimiter namespace exports buildGuard and buildProvider', () => {
    expect(rateLimiter.buildGuard).toBeDefined()
    expect(rateLimiter.buildProvider).toBeDefined()
  })
})
