import { InMemorySlotProvider } from '../src/implementation/in-memory'
import { RedisSlotProvider } from '../src/implementation/redis'
import { SlidingWindow } from '../src/sliding-window'
import { createClient } from '@redis/client'
import { describe, expect, test } from 'vitest'

describe('Sliding window in memory', async () => {
  const slotProvider = new InMemorySlotProvider()
  test('errors', () => {
    expect(
      () => new SlidingWindow({ rate: { requests: 10, period: 0.5, unit: 'seconds' }, slotProvider, key: '' }),
    ).toThrowError('Sampling period must be at least 1 second')
    expect(
      () => new SlidingWindow({ rate: { requests: -10, period: 30, unit: 'seconds' }, slotProvider, key: '' }),
    ).toThrowError('Rate limit must be a positive duration')
  })
  test('0 rate limit', () => {
    const window = new SlidingWindow({ rate: { requests: 0, period: 30, unit: 'seconds' }, slotProvider, key: '' })
    expect(window.inc()).toBe('rate-limited')
  })
  test('rate limits', async () => {
    let now = 100
    const window = new SlidingWindow({
      rate: { requests: 10, period: 30, unit: 'seconds' },
      nowSeconds: () => now,
      slotProvider,
      key: '',
    })
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('rate-limited')
    expect(window.inc()).toBe('rate-limited')
    now = 120
    expect(window.inc()).toBe('rate-limited')
    now = 121
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('rate-limited')
    now = 122.9
    expect(window.inc()).toBe('rate-limited')
    now = 123.01
    expect(window.inc()).toBe('allowed')
    now = 150
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('allowed')
    expect(window.inc()).toBe('rate-limited')
  })
})

//TODO: redis provider test?
