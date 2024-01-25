import { InMemoryStore } from '../src/implementation/in-memory'
import { RedisStore } from '../src/implementation/redis'
import { Rate } from '../src/rate'
import { SlidingWindow } from '../src/sliding-window'
import { randomUUID } from 'crypto'
import { describe, expect, test } from 'vitest'

describe('Sliding window in memory', async () => {
  const store = new InMemoryStore()
  test('errors', () => {
    expect(
      () =>
        new SlidingWindow({
          rate: new Rate({ requests: 10, period: 0.5, scale: 'second' }),
          store,
          key: randomUUID(),
        }),
    ).toThrowError('Sampling period must be at least 1 second')
    expect(
      () =>
        new SlidingWindow({
          rate: new Rate({ requests: -10, period: 30, scale: 'second' }),
          store,
          key: randomUUID(),
        }),
    ).toThrowError('Rate limit must be a positive duration')
  })
  test('0 rate limit', () => {
    const window = new SlidingWindow({
      rate: new Rate({ requests: 0, period: 30, scale: 'second' }),
      store,
      key: randomUUID(),
    })
    expect(window.isRateLimited(new Date())).toBe('rate-limited')
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
