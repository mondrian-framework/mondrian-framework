import { decoder, types, path } from '../src'
import { areSameArray } from '../src/utils'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

function compareDecoderErrors(one: decoder.Error[], other: decoder.Error[]): boolean {
  const compareSingleErrors = (one: decoder.Error, other: decoder.Error) =>
    one.expected === other.expected && one.got === other.got && one.path.equals(other.path)
  return areSameArray(one, other, compareSingleErrors)
}

const number = gen.oneof(gen.integer(), gen.double(), gen.float())

function checkError(result: decoder.Result<any>, expectedError: decoder.Error[]): void {
  const error = assertFailure(result)
  const isExpectedError = compareDecoderErrors(error, expectedError)
  expect(isExpectedError).toBe(true)
}

function checkValue<A>(result: decoder.Result<A>, expectedValue: A): void {
  const value = assertOk(result)
  expect(value).toEqual(expectedValue)
}

describe('decoder.decodeWithoutValidation', () => {
  describe('boolean value', () => {
    const model = types.boolean()
    const nonBooleans = gen.anything().filter((value) => typeof value !== 'boolean')

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonBooleans])('fails on non booleans', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'boolean', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([gen.boolean()])('can decode booleans', (boolean) => {
        const result = decoder.decodeWithoutValidation(model, boolean, options)
        checkValue(result, boolean)
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode the strings "true" and "false"', () => {
        checkValue(decoder.decodeWithoutValidation(model, 'true', options), true)
        checkValue(decoder.decodeWithoutValidation(model, 'false', options), false)
      })

      test('decodes 0 as false', () => {
        checkValue(decoder.decodeWithoutValidation(model, 0, options), false)
      })

      test.prop([number.filter((n) => n !== 0)])('decodes non-zero number as true', (n) => {
        checkValue(decoder.decodeWithoutValidation(model, n, options), true)
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
        const expectedError = [{ expected: 'number', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([number])('can decode numbers', (n) => {
        checkValue(decoder.decodeWithoutValidation(model, n, options), n)
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const
      test.prop([number])('can decode number strings', (n) => {
        checkValue(decoder.decodeWithoutValidation(model, n.toString(), options), n)
      })

      test('still fails with non number strings', () => {
        for (const value of ['foo', 'bar', '1.1not a number']) {
          const result = decoder.decodeWithoutValidation(model, value, options)
          const expectedError = [{ expected: 'number', got: value, path: path.empty() }]
          checkError(result, expectedError)
        }
      })
    })
  })

  describe('string value', () => {
    const model = types.string()

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const nonString = gen.anything().filter((value) => typeof value !== 'string')

      test.prop([nonString])('fails on non strings', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'string', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([gen.string()])('can decode strings', (string) => {
        checkValue(decoder.decodeWithoutValidation(model, string, options), string)
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test.prop([number])('can decode numbers as strings', (number) => {
        const result = decoder.decodeWithoutValidation(model, number, options)
        checkValue(result, number.toString())
      })

      test.prop([gen.boolean()])('can decode booleans as strings', (boolean) => {
        const result = decoder.decodeWithoutValidation(model, boolean, options)
        checkValue(result, boolean ? 'true' : 'false')
      })
    })
  })
})

describe('decoder.decode', () => {
  test('should perform validation', () => {
    // expect.fail('TODO: check')
  })
})
