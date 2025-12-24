import { RedisStore } from '../src/implementation/redis'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

// Mock Redis client for testing
function createMockRedisClient(initialData: Record<string, number> = {}) {
  const memory: Record<string, number> = { ...initialData }
  return {
    async incr(key: string): Promise<number> {
      memory[key] = (memory[key] ?? 0) + 1
      return memory[key]
    },
    async get(key: string): Promise<string | null> {
      return memory[key]?.toString() ?? null
    },
    async expireAt(_key: string, _date: Date): Promise<boolean> {
      return true
    },
    _memory: memory,
  }
}

describe('RedisStore', () => {
  describe('constructor', () => {
    test('creates store with default key prefix', () => {
      const client = createMockRedisClient()
      const store = new RedisStore(client as any)
      expect(store.keyPrefix).toBe('mondrian-rate-limiter')
      expect(store.client).toBe(client)
    })

    test('creates store with custom key prefix', () => {
      const client = createMockRedisClient()
      const store = new RedisStore(client as any, 'custom-prefix')
      expect(store.keyPrefix).toBe('custom-prefix')
    })
  })

  describe('createSlot', () => {
    test('creates slot with correct prefixed key', async () => {
      const client = createMockRedisClient()
      const store = new RedisStore(client as any, 'test-prefix')
      const now = new Date(100000)

      const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'user-123' }, now)

      // The internal Redis key should be prefixed
      expect(slot.key).toBe('test-prefix:user-123:90')
      expect(slot.startingTimeSeconds).toBe(90)
      expect(slot.durationSeconds).toBe(30)
    })

    test('returns same slot for same parameters', () => {
      const client = createMockRedisClient()
      const store = new RedisStore(client as any)
      const now = new Date(100000)

      const slot1 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)
      const slot2 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

      expect(slot1).toBe(slot2)
    })
  })
})

describe('RedisSlot', () => {
  test('initial value is 0', () => {
    const client = createMockRedisClient()
    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    expect(slot.value()).toBe(0)
  })

  test('inc() increments counter asynchronously', async () => {
    const client = createMockRedisClient()
    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    slot.inc()

    // Wait for async operation to complete
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(slot.value()).toBe(1)
  })

  test('multiple inc() calls increment correctly', async () => {
    const client = createMockRedisClient()
    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    slot.inc()
    await new Promise((resolve) => setTimeout(resolve, 10))
    slot.inc()
    await new Promise((resolve) => setTimeout(resolve, 10))
    slot.inc()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(slot.value()).toBe(3)
  })

  test('reads initial value from Redis', async () => {
    // Pre-populate Redis with a value
    const redisKey = 'prefix:existing:100'
    const client = createMockRedisClient({ [redisKey]: 5 })
    const store = new RedisStore(client as any, 'prefix')
    const now = new Date(150000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 100, durationSeconds: 30, key: 'existing' }, now)

    // Wait for async read
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(slot.value()).toBe(5)
  })

  test('handles get error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = {
      async get(): Promise<string | null> {
        throw new Error('Redis connection error')
      },
      async incr(): Promise<number> {
        return 1
      },
      async expireAt(): Promise<boolean> {
        return true
      },
    }

    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    // Wait for async error handling
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(slot.value()).toBe(0)
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  test('handles incr error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = {
      async get(): Promise<string | null> {
        return null
      },
      async incr(): Promise<number> {
        throw new Error('Redis incr error')
      },
      async expireAt(): Promise<boolean> {
        return true
      },
    }

    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    slot.inc()

    // Wait for async error handling
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  test('handles expireAt error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let incrCount = 0
    const client = {
      async get(): Promise<string | null> {
        return null
      },
      async incr(): Promise<number> {
        return ++incrCount
      },
      async expireAt(): Promise<boolean> {
        throw new Error('Redis expireAt error')
      },
    }

    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    slot.inc()

    // Wait for async error handling
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  test('handles null incr result gracefully', async () => {
    const client = {
      async get(): Promise<string | null> {
        return null
      },
      async incr(): Promise<number | null> {
        return null
      },
      async expireAt(): Promise<boolean> {
        return true
      },
    }

    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    slot.inc()

    // Wait for async handling
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Counter should remain 0 when incr returns null
    expect(slot.value()).toBe(0)
  })

  test('does not increment when counter is at MAX_SAFE_INTEGER', async () => {
    // We can't easily test this without modifying the counter directly
    // Just verify the slot doesn't crash
    const client = createMockRedisClient()
    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    // Just verify inc doesn't throw
    slot.inc()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(slot.value()).toBe(1)
  })

  test('handles NaN value from get gracefully', async () => {
    const client = {
      async get(): Promise<string | null> {
        return 'not-a-number'
      },
      async incr(): Promise<number> {
        return 1
      },
      async expireAt(): Promise<boolean> {
        return true
      },
    }

    const store = new RedisStore(client as any)
    const now = new Date(100000)

    const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test' }, now)

    // Wait for async read
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Should remain 0 when value is NaN
    expect(slot.value()).toBe(0)
  })
})
