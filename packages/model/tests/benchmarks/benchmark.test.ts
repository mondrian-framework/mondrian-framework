import m, { validate } from '../../src'
import { getArbitrary } from '../generator-utils'
import { test } from '@fast-check/vitest'
import { fc as gen } from '@fast-check/vitest'
import prand from 'pure-rand'
import { expect, describe } from 'vitest'

describe('benchmark', () => {
  test('Simple object', () => {
    const myType = () =>
      m.object({
        a: m.number({ multipleOf: 3, minimum: [1, 'inclusive'], maximum: [41.9, 'inclusive'] }),
        b: m.string({ minLength: 3, maxLength: 10 }),
      })
    const arbitrary = getArbitrary(myType)
    const random = new gen.Random(prand.xoroshiro128plus(0))
    for (let i = 0; i < 1000; i++) {
      const value = arbitrary.generate(random, undefined).value
      const v = validate(myType, value)
      expect(v.success).toBe(true)
    }
  })
})
