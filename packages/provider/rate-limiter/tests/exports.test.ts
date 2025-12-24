import * as allExports from '../src'
import { rateLimiter, Slot, Store, RedisStore, Rate, RateLiteral, parseRate } from '../src'
import { describe, expect, test } from 'vitest'

describe('index exports', () => {
  test('exports rateLimiter namespace', () => {
    expect(allExports.rateLimiter).toBeDefined()
    expect(allExports.rateLimiter.buildGuard).toBeDefined()
    expect(allExports.rateLimiter.buildProvider).toBeDefined()
  })

  test('exports Slot interface type', () => {
    // Slot is an interface, so we just verify it's a valid type reference
    const slot: Slot = {
      startingTimeSeconds: 0,
      durationSeconds: 30,
      key: 'test',
      inc: () => {},
      value: () => 0,
    }
    expect(slot).toBeDefined()
  })

  test('exports Store abstract class', () => {
    expect(allExports.Store).toBeDefined()
    expect(Store).toBeDefined()
  })

  test('exports RedisStore class', () => {
    expect(allExports.RedisStore).toBeDefined()
    expect(RedisStore).toBeDefined()
  })

  test('exports Rate class', () => {
    expect(allExports.Rate).toBeDefined()
    expect(Rate).toBeDefined()

    const rate = new Rate({ requests: 10, period: 1, scale: 'minute' })
    expect(rate.requests).toBe(10)
    expect(rate.period).toBe(1)
    expect(rate.scale).toBe('minute')
  })

  test('exports parseRate function', () => {
    expect(allExports.parseRate).toBeDefined()
    expect(parseRate).toBeDefined()

    const rate = parseRate('10 requests in 1 minute')
    expect(rate.requests).toBe(10)
    expect(rate.period).toBe(1)
    expect(rate.scale).toBe('minute')
  })
})

describe('rateLimiter namespace', () => {
  test('buildGuard is a function', () => {
    expect(typeof rateLimiter.buildGuard).toBe('function')
  })

  test('buildProvider is a function', () => {
    expect(typeof rateLimiter.buildProvider).toBe('function')
  })
})
