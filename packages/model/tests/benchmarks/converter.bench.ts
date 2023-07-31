import m, { Infer, decode, encode, getArbitrary, validate } from '../../src'
import { test } from '@fast-check/vitest'
import { fc as gen } from '@fast-check/vitest'
import prand from 'pure-rand'
import { expect, describe, bench } from 'vitest'

const User = () =>
  m.object({
    username: m.string({ minLength: 3, maxLength: 30 }),
    email: m.string().nullable(),
    points: m.integer({ minimum: [0, 'inclusive'], maximum: [Number.MAX_SAFE_INTEGER, 'exclusive'] }),
    referredBy: m.optional(User),
    posts: m.array(Post),
  })
const Post = () =>
  m.object({
    title: m.string({ minLength: 1, maxLength: 200 }),
    content: m.string({ minLength: 0, maxLength: 2000 }),
    owner: User,
    likes: m.array(User),
  })
const arbitrary = getArbitrary(User, 3)
const random = new gen.Random(prand.xoroshiro128plus(0))
const values: Infer<typeof User>[] = []
const encodedValues: unknown[] = []
let size = 0
for (let i = 0; i < 50000; i++) {
  const value = arbitrary.generate(random, undefined).value
  values.push(value)
  encodedValues.push(encode(User, value))
}

describe('benchmark', () => {
  bench('validate', () => {
    for (let i = 0; i < values.length; i++) {
      validate(User, values[i])
    }
  })
  bench('encode', () => {
    for (let i = 0; i < values.length; i++) {
      encode(User, values[i])
    }
  })
  bench('decode', () => {
    for (let i = 0; i < values.length; i++) {
      decode(User, encodedValues[i])
    }
  })
})
