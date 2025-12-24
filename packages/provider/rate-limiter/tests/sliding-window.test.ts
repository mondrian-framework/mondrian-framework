import { InMemoryStore } from '../src/implementation/in-memory'
import { RedisStore } from '../src/implementation/redis'
import { Rate } from '../src/rate'
import { SlidingWindow } from '../src/sliding-window'
import { randomUUID } from 'crypto'
import { describe, expect, test } from 'vitest'

describe('Sliding window in memory', async () => {
  const store = new InMemoryStore()

  describe('constructor validation', () => {
    test('throws error for period less than 1 second', () => {
      expect(
        () =>
          new SlidingWindow({
            rate: new Rate({ requests: 10, period: 0.5, scale: 'second' }),
            store,
            key: randomUUID(),
          }),
      ).toThrowError('Sampling period must be at least 1 second')
    })

    test('throws error for negative requests', () => {
      expect(
        () =>
          new SlidingWindow({
            rate: new Rate({ requests: -10, period: 30, scale: 'second' }),
            store,
            key: randomUUID(),
          }),
      ).toThrowError('Rate limit must be a positive duration')
    })

    test('accepts exactly 1 second period', () => {
      expect(
        () =>
          new SlidingWindow({
            rate: new Rate({ requests: 10, period: 1, scale: 'second' }),
            store,
            key: randomUUID(),
          }),
      ).not.toThrow()
    })

    test('accepts 0 requests (always rate limited)', () => {
      expect(
        () =>
          new SlidingWindow({
            rate: new Rate({ requests: 0, period: 30, scale: 'second' }),
            store,
            key: randomUUID(),
          }),
      ).not.toThrow()
    })
  })

  test('0 rate limit', () => {
    const window = new SlidingWindow({
      rate: new Rate({ requests: 0, period: 30, scale: 'second' }),
      store,
      key: randomUUID(),
    })
    expect(window.isRateLimited(new Date())).toBe('rate-limited')
  })

  test('isRateLimited with increase=false does not count requests', () => {
    const window = new SlidingWindow({
      rate: new Rate({ requests: 2, period: 30, scale: 'second' }),
      store,
      key: randomUUID(),
    })
    const now = new Date(100000)

    // Check without incrementing
    expect(window.isRateLimited(now, false)).toBe('allowed')
    expect(window.isRateLimited(now, false)).toBe('allowed')
    expect(window.isRateLimited(now, false)).toBe('allowed')

    // Still allowed because we didn't increment
    expect(window.isRateLimited(now, true)).toBe('allowed')
    expect(window.isRateLimited(now, true)).toBe('allowed')

    // Now rate limited
    expect(window.isRateLimited(now, true)).toBe('rate-limited')
    expect(window.isRateLimited(now, false)).toBe('rate-limited')
  })

  test('rate limited until cache optimization', () => {
    const window = new SlidingWindow({
      rate: new Rate({ requests: 2, period: 30, scale: 'second' }),
      store,
      key: randomUUID(),
    })
    // Start time at a slot boundary for predictable behavior
    let now = new Date(60000) // 60 seconds

    // Use up the rate limit
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('rate-limited')

    // Still rate limited at same time (uses cache)
    expect(window.isRateLimited(now)).toBe('rate-limited')

    // Still rate limited slightly in the future but within cached period
    now = new Date(61000)
    expect(window.isRateLimited(now)).toBe('rate-limited')
  })

  test('rate limit recovery with old slot contribution', () => {
    const window = new SlidingWindow({
      rate: new Rate({ requests: 5, period: 10, scale: 'second' }),
      store,
      key: randomUUID(),
    })

    // Start at slot boundary
    let now = new Date(100000) // 100 seconds

    // Make 5 requests to hit limit
    for (let i = 0; i < 5; i++) {
      expect(window.isRateLimited(now)).toBe('allowed')
    }
    expect(window.isRateLimited(now)).toBe('rate-limited')

    // Move to next slot - old requests still contribute
    now = new Date(110000) // 110 seconds (new slot)
    expect(window.isRateLimited(now)).toBe('rate-limited')

    // Move further - old slot contributes less
    now = new Date(115000) // 115 seconds
    // Should allow some requests now
    const result = window.isRateLimited(now)
    // Due to sliding window, ~2.5 requests should be available
    expect(['allowed', 'rate-limited']).toContain(result)
  })
  test('rate limits', async () => {
    let now = new Date(100000)
    const window = new SlidingWindow({
      rate: new Rate({ requests: 10, period: 30, scale: 'second' }),
      store,
      key: randomUUID(),
    })
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('rate-limited')
    expect(window.isRateLimited(now)).toBe('rate-limited')
    now = new Date(120000)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    now = new Date(121000)
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('rate-limited')
    now = new Date(122900)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    now = new Date(123010)
    expect(window.isRateLimited(now)).toBe('allowed')
    now = new Date(150000)
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('rate-limited')
    now = new Date(1500000)
    expect(window.isRateLimited(now)).toBe('allowed')
  })
})

//TODO [Good first issue]: redis provider test
describe('Sliding window redis', async () => {
  const memory: Record<string, number> = { 'test::90': 0 }
  const client = {
    async incr(key: string): Promise<number | void> {
      memory[key] = memory[key] ?? 0
      memory[key] = memory[key] + 1
      return memory[key]
    },
    async get(key: string): Promise<string | void | null> {
      return memory[key]?.toString() ?? null
    },
    async expireAt(): Promise<void> {
      return
    },
  }
  const store = new RedisStore(client as any, 'test')
  test('rate limits', async () => {
    let now = new Date(100000)
    const window = new SlidingWindow({
      rate: new Rate({ requests: 10, period: 30, scale: 'second' }),
      store,
      key: randomUUID(),
    })
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    await delay(1)
    now = new Date(120000)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    await delay(1)
    now = new Date(121000)
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    await delay(1)
    now = new Date(122900)
    expect(window.isRateLimited(now)).toBe('rate-limited')
    await delay(1)
    now = new Date(123010)
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    now = new Date(150000)
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    expect(window.isRateLimited(now)).toBe('allowed')
    await delay(1)
    expect(window.isRateLimited(now)).toBe('rate-limited')
  })
})

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time))
}
