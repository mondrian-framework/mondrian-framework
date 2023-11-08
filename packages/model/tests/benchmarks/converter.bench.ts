import m, { arbitrary, decoding, encoder, model, validator } from '../../src'
import { fc as gen } from '@fast-check/vitest'
import prand from 'pure-rand'
import { describe, bench } from 'vitest'

const User = () =>
  m.object({
    username: m.string({ minLength: 3, maxLength: 30 }),
    email: m.string().nullable(),
    points: m.integer({ minimum: 0, exclusiveMaximum: Number.MAX_SAFE_INTEGER }),
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
const generator = arbitrary.fromType(User, {}, 3)
const random = new gen.Random(prand.xoroshiro128plus(0))
const values: model.Infer<typeof User>[] = []
const encodedValues: unknown[] = []

for (let i = 0; i < 5000; i++) {
  const value = generator.generate(random, undefined).value
  values.push(value)
  encodedValues.push(encoder.encode(User, value))
}

describe('benchmark', () => {
  bench('[ACTUAL] validate', () => {
    for (let i = 0; i < values.length; i++) {
      validator.validate(User, values[i])
    }
  })

  bench('[ACTUAL] decode', () => {
    for (let i = 0; i < values.length; i++) {
      decoding.decode(User, encodedValues[i])
    }
  })
  bench('[ACTUAL] encode', () => {
    for (let i = 0; i < values.length; i++) {
      encoder.encode(User, values[i])
    }
  })
})
