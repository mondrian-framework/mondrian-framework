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
  describe('number value', () => {
    const model = types.number()

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      test('fails on non numbers', () => {
        for (const value of [null, undefined, '1', '1.1', { a: 1 }]) {
          const result = decoder.decodeWithoutValidation(model, value, options)
          expectFailure(result, [{ expected: 'number', got: value, path: path.empty() }], compareDecoderErrors)
        }
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
