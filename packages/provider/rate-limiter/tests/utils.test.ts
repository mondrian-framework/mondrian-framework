import { RateLiteral, parseRate } from '../src/rate'
import { expect, test } from 'vitest'

test('rate', () => {
  const r1: RateLiteral = '1 request in 20 minutes'
  expect(parseRate(r1)).toEqual({ requests: 1, period: 20, scale: 'minute' })

  const r2: RateLiteral = '1 request in 1 minute'
  expect(parseRate(r2)).toEqual({ requests: 1, period: 1, scale: 'minute' })

  const r3: RateLiteral = '10 requests in -1 second'
  expect(parseRate(r3)).toEqual({ requests: 10, period: -1, scale: 'second' })

  const r4: RateLiteral = '10 requests in 10 seconds'
  expect(parseRate(r4)).toEqual({ requests: 10, period: 10, scale: 'second' })

  const r5: RateLiteral = '-10 requests in 1 hour'
  expect(parseRate(r5)).toEqual({ requests: -10, period: 1, scale: 'hour' })

  const r6: RateLiteral = '1E2 requests in 0.05 hours'
  expect(parseRate(r6)).toEqual({ requests: 100, period: 0.05, scale: 'hour' })
})
