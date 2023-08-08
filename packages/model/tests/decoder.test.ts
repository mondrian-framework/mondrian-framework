import { decoder, types, path } from '../src'
import { areSameArray } from '../src/utils'
import { expectFailure, expectOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

function compareDecoderErrors(one: decoder.Error[], other: decoder.Error[]): boolean {
  const compareSingleErrors = (one: decoder.Error, other: decoder.Error) =>
    one.expected === other.expected && one.got === other.got && one.path.equals(other.path)
  return areSameArray(one, other, compareSingleErrors)
}

const number = gen.oneof(gen.integer(), gen.double(), gen.float())

describe('decoder.decodeWithoutValidation', () => {
  describe('boolean value', () => {
    const model = types.boolean()
    const nonBooleans = gen.anything().filter((value) => typeof value !== 'boolean')

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonBooleans])('fails on non booleans', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        expectFailure(result, [{ expected: 'boolean', got: value, path: path.empty() }], compareDecoderErrors)
      })

      test.prop([gen.boolean()])('can decode booleans', (boolean) => {
        const result = decoder.decodeWithoutValidation(model, boolean, options)
        expectOk(result, boolean)
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode the strings "true" and "false"', () => {
        expectOk(decoder.decodeWithoutValidation(model, 'true', options), true)
        expectOk(decoder.decodeWithoutValidation(model, 'false', options), false)
      })

      test('decodes 0 as false', () => {
        expectOk(decoder.decodeWithoutValidation(model, 0, options), false)
      })

      test.prop([number.filter((n) => n !== 0)])('decodes non-zero number as true', (n) => {
        expectOk(decoder.decodeWithoutValidation(model, n, options), true)
      })
    })
  })

  describe('number value', () => {
    const model = types.number()

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const nonNumbers = gen.anything().filter((value) => typeof value !== 'number')

      test.prop([nonNumbers])('fails on non numbers', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        expectFailure(result, [{ expected: 'number', got: value, path: path.empty() }], compareDecoderErrors)
      })

      test.prop([number])('can decode numbers', (n) => {
        const result = decoder.decodeWithoutValidation(model, n, options)
        expectOk(result, n)
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const
      test.prop([number])('can decode number strings', (n) => {
        const result = decoder.decodeWithoutValidation(model, n.toString(), options)
        expectOk(result, n)
      })

      test('still fails with non number strings', () => {
        for (const value of ['foo', 'bar', '1.1not a number']) {
          const result = decoder.decodeWithoutValidation(model, value, options)
          expectFailure(result, [{ expected: 'number', got: value, path: path.empty() }], compareDecoderErrors)
        }
      })
    })
  })
})

describe('decoder.decode', () => {
  test('should perform validation', () => {
    // expect.fail('TODO: check')
  })
})
