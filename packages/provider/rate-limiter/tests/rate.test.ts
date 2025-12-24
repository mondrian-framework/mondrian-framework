import { Rate, RateLiteral, parseRate, TimeScale } from '../src/rate'
import { describe, expect, test } from 'vitest'

describe('Rate class', () => {
  describe('constructor', () => {
    test('creates Rate with second scale', () => {
      const rate = new Rate({ requests: 100, period: 30, scale: 'second' })
      expect(rate.requests).toBe(100)
      expect(rate.period).toBe(30)
      expect(rate.scale).toBe('second')
    })

    test('creates Rate with minute scale', () => {
      const rate = new Rate({ requests: 50, period: 5, scale: 'minute' })
      expect(rate.requests).toBe(50)
      expect(rate.period).toBe(5)
      expect(rate.scale).toBe('minute')
    })

    test('creates Rate with hour scale', () => {
      const rate = new Rate({ requests: 1000, period: 2, scale: 'hour' })
      expect(rate.requests).toBe(1000)
      expect(rate.period).toBe(2)
      expect(rate.scale).toBe('hour')
    })
  })

  describe('periodInSeconds', () => {
    test('returns correct seconds for second scale', () => {
      const rate = new Rate({ requests: 10, period: 45, scale: 'second' })
      expect(rate.periodInSeconds).toBe(45)
    })

    test('returns correct seconds for minute scale', () => {
      const rate = new Rate({ requests: 10, period: 2, scale: 'minute' })
      expect(rate.periodInSeconds).toBe(120)
    })

    test('returns correct seconds for hour scale', () => {
      const rate = new Rate({ requests: 10, period: 1.5, scale: 'hour' })
      expect(rate.periodInSeconds).toBe(5400)
    })

    test('handles fractional periods', () => {
      const rate = new Rate({ requests: 10, period: 0.5, scale: 'minute' })
      expect(rate.periodInSeconds).toBe(30)
    })
  })
})

describe('parseRate', () => {
  describe('singular request', () => {
    test('parses "1 request in X seconds"', () => {
      const rate = parseRate('1 request in 30 seconds')
      expect(rate.requests).toBe(1)
      expect(rate.period).toBe(30)
      expect(rate.scale).toBe('second')
    })

    test('parses "1 request in X second"', () => {
      const rate = parseRate('1 request in 1 second')
      expect(rate.requests).toBe(1)
      expect(rate.period).toBe(1)
      expect(rate.scale).toBe('second')
    })

    test('parses "1 request in X minutes"', () => {
      const rate = parseRate('1 request in 20 minutes')
      expect(rate.requests).toBe(1)
      expect(rate.period).toBe(20)
      expect(rate.scale).toBe('minute')
    })

    test('parses "1 request in X minute"', () => {
      const rate = parseRate('1 request in 1 minute')
      expect(rate.requests).toBe(1)
      expect(rate.period).toBe(1)
      expect(rate.scale).toBe('minute')
    })

    test('parses "1 request in X hours"', () => {
      const rate = parseRate('1 request in 2 hours')
      expect(rate.requests).toBe(1)
      expect(rate.period).toBe(2)
      expect(rate.scale).toBe('hour')
    })

    test('parses "1 request in X hour"', () => {
      const rate = parseRate('1 request in 1 hour')
      expect(rate.requests).toBe(1)
      expect(rate.period).toBe(1)
      expect(rate.scale).toBe('hour')
    })
  })

  describe('plural requests', () => {
    test('parses "X requests in Y seconds"', () => {
      const rate = parseRate('10 requests in 10 seconds')
      expect(rate.requests).toBe(10)
      expect(rate.period).toBe(10)
      expect(rate.scale).toBe('second')
    })

    test('parses "X requests in Y minutes"', () => {
      const rate = parseRate('100 requests in 5 minutes')
      expect(rate.requests).toBe(100)
      expect(rate.period).toBe(5)
      expect(rate.scale).toBe('minute')
    })

    test('parses "X requests in Y hours"', () => {
      const rate = parseRate('1000 requests in 24 hours')
      expect(rate.requests).toBe(1000)
      expect(rate.period).toBe(24)
      expect(rate.scale).toBe('hour')
    })
  })

  describe('edge cases', () => {
    test('parses negative requests', () => {
      const rate = parseRate('-10 requests in 1 hour')
      expect(rate.requests).toBe(-10)
      expect(rate.period).toBe(1)
      expect(rate.scale).toBe('hour')
    })

    test('parses negative period', () => {
      const rate = parseRate('10 requests in -1 second')
      expect(rate.requests).toBe(10)
      expect(rate.period).toBe(-1)
      expect(rate.scale).toBe('second')
    })

    test('parses fractional period', () => {
      const rate = parseRate('1E2 requests in 0.05 hours')
      expect(rate.requests).toBe(100)
      expect(rate.period).toBe(0.05)
      expect(rate.scale).toBe('hour')
    })

    test('parses large numbers', () => {
      const rate = parseRate('999999 requests in 1000 seconds')
      expect(rate.requests).toBe(999999)
      expect(rate.period).toBe(1000)
      expect(rate.scale).toBe('second')
    })

    test('parses zero requests', () => {
      const rate = parseRate('0 requests in 1 minute')
      expect(rate.requests).toBe(0)
      expect(rate.period).toBe(1)
      expect(rate.scale).toBe('minute')
    })
  })
})
