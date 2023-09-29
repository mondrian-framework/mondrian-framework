import { InMemorySlotProvider } from '../src/implementation/in-memory'
import { Rate } from '../src/rate'
import { SlidingWindow } from '../src/sliding-window'
import { describe, expect, test } from 'vitest'

describe('Sliding window in memory', async () => {
  const slotProvider = new InMemorySlotProvider()
  test('errors', () => {
    expect(
      () =>
        new SlidingWindow({ rate: new Rate({ requests: 10, period: 0.5, scale: 'second' }), slotProvider, key: '' }),
    ).toThrowError('Sampling period must be at least 1 second')
    expect(
      () =>
        new SlidingWindow({ rate: new Rate({ requests: -10, period: 30, scale: 'second' }), slotProvider, key: '' }),
    ).toThrowError('Rate limit must be a positive duration')
  })
  test('0 rate limit', () => {
    const window = new SlidingWindow({
      rate: new Rate({ requests: 0, period: 30, scale: 'second' }),
      slotProvider,
      key: '',
    })
    expect(window.isRateLimited(new Date())).toBe('rate-limited')
  })
  test('rate limits', async () => {
    let now = new Date(100000)
    const window = new SlidingWindow({
      rate: new Rate({ requests: 10, period: 30, scale: 'second' }),
      slotProvider,
      key: '',
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
  })
})

//TODO: redis provider test?
