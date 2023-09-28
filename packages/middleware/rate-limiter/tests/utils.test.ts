import { RateLiteral, parseRate } from '../src/rate'
import { expect, test } from 'vitest'

test('rate', () => {
  const r1: RateLiteral = '10 requests in 20 minutes'
  expect(parseRate(r1)).toEqual({ requests: 10, period: 20, unit: 'minutes' })

  const r2: RateLiteral = '10 requests in -20 seconds'
  expect(parseRate(r2)).toEqual({ requests: 10, period: -20, unit: 'seconds' })

  const r3: RateLiteral = '-10 requests in 20 hours'
  expect(parseRate(r3)).toEqual({ requests: -10, period: 20, unit: 'hours' })

  const r4: RateLiteral = '1E2 requests in 0.05 hours'
  expect(parseRate(r4)).toEqual({ requests: 100, period: 0.05, unit: 'hours' })
})
