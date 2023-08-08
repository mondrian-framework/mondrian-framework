import { decoder, types, path } from '../src'
import { areSameArray } from '../src/utils'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

function compareDecoderErrors(one: decoder.Error[], other: decoder.Error[]): boolean {
  const compareSingleErrors = (one: decoder.Error, other: decoder.Error) => {
    const expectedAreEqual = one.expected === other.expected
    const gotAreEqual = one.got === other.got || (Number.isNaN(one.got) && Number.isNaN(other.got))
    const pathsAreEqual = one.path.equals(other.path)
    return expectedAreEqual && gotAreEqual && pathsAreEqual
  }
  return areSameArray(one, other, compareSingleErrors)
}

const number = gen.oneof(gen.integer(), gen.double(), gen.float())
const nonString = gen.anything().filter((value) => typeof value !== 'string')
const nonBoolean = gen.anything().filter((value) => typeof value !== 'boolean')
const nonNumber = gen.anything().filter((value) => typeof value !== 'number')
const nonNull = gen.anything().filter((value) => value !== null)
const nonArray = gen.anything().filter((value) => !(value instanceof Array))

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

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonBoolean])('fails on non booleans', (value) => {
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

      test.prop([nonNumber])('fails on non numbers', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'number', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([number])('can decode numbers', (n) => {
        checkValue(decoder.decodeWithoutValidation(model, n, options), n)
      })

      test('can decode NaN', () => {
        const result = decoder.decodeWithoutValidation(model, NaN, options)
        if (!result.isOk || !Number.isNaN(result.value)) {
          expect.fail('should work on NaN')
        }
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('works with +-0 strings', () => {
        checkValue(decoder.decodeWithoutValidation(model, '+0', options), 0)
        checkValue(decoder.decodeWithoutValidation(model, '-0', options), -0)
      })

      test.prop([number.filter((n) => n !== 0 && !Number.isNaN(n))])('can decode number strings', (n) => {
        checkValue(decoder.decodeWithoutValidation(model, n.toString(), options), n)
      })

      test('still fails with non number strings', () => {
        for (const value of ['foo', 'bar', '1.1 not a number']) {
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

  describe('literal value', () => {
    describe('literal number', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const literalValue = 1
      const model = types.literal(literalValue)

      test('can decode the exact same literal', () => {
        checkValue(decoder.decodeWithoutValidation(model, literalValue, options), literalValue)
      })

      test.prop([number.filter((n) => n !== literalValue)])('fails on numbers that are not the literal', (n) => {
        const result = decoder.decodeWithoutValidation(model, n, options)
        const expectedError = [{ expected: 'literal (1)', got: n, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([nonNumber])('fails on non number values', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'literal (1)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe('literal string', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const literalValue = 'mondrian'
      const model = types.literal(literalValue)

      test('can decode the exact same literal', () => {
        checkValue(decoder.decodeWithoutValidation(model, literalValue, options), literalValue)
      })

      test.prop([gen.string().filter((s) => s !== literalValue)])(
        'fails on strings that are not the literal',
        (string) => {
          const result = decoder.decodeWithoutValidation(model, string, options)
          const expectedError = [{ expected: 'literal (mondrian)', got: string, path: path.empty() }]
          checkError(result, expectedError)
        },
      )

      test.prop([nonString])('fail on non string values', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'literal (mondrian)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe('literal boolean', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const literalValue = true
      const model = types.literal(literalValue)

      test('can decode the exact same literal', () => {
        checkValue(decoder.decodeWithoutValidation(model, literalValue, options), literalValue)
      })

      test.prop([gen.boolean().filter((b) => b !== literalValue)])(
        'fails on booleans that are not the literal',
        (boolean) => {
          const result = decoder.decodeWithoutValidation(model, boolean, options)
          const expectedError = [{ expected: 'literal (true)', got: boolean, path: path.empty() }]
          checkError(result, expectedError)
        },
      )

      test.prop([nonBoolean])('fails on non boolean values', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'literal (true)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe('literal null', () => {
      const literalValue = null
      const model = types.literal(literalValue)

      describe('without casting', () => {
        const options = { typeCastingStrategy: 'expectExactTypes' } as const

        test('can decode the exact same literal', () => {
          checkValue(decoder.decodeWithoutValidation(model, literalValue, options), literalValue)
        })

        test.prop([nonNull])('fails on non null values', (value) => {
          const result = decoder.decodeWithoutValidation(model, value, options)
          const expectedError = [{ expected: 'literal (null)', got: value, path: path.empty() }]
          checkError(result, expectedError)
        })
      })

      describe('with casting', () => {
        const options = { typeCastingStrategy: 'tryCasting' } as const

        test('can decode the "null" string as the null literal', () => {
          checkValue(decoder.decodeWithoutValidation(model, 'null', options), null)
        })

        test.prop([gen.string().filter((s) => s !== 'null')])('fails on other strings', (string) => {
          const result = decoder.decodeWithoutValidation(model, string, options)
          const expectedError = [{ expected: 'literal (null)', got: string, path: path.empty() }]
          checkError(result, expectedError)
        })
      })
    })
  })

  describe('enum variant', () => {
    const variants = ['one', 'two', 'three'] as const
    const model = types.enumeration(variants)

    test.prop([gen.constantFrom(...variants)])('can decode its variants', (variant) => {
      checkValue(decoder.decodeWithoutValidation(model, variant), variant)
    })

    const nonVariant = gen.string().filter((s) => !(variants as readonly string[]).includes(s))
    test.prop([nonVariant])('fails on non variant strings', (string) => {
      const result = decoder.decodeWithoutValidation(model, string)
      const expectedError = [{ expected: 'enum ("one" | "two" | "three")', got: string, path: path.empty() }]
      checkError(result, expectedError)
    })

    test.prop([nonString])('fails on non strings', (value) => {
      const result = decoder.decodeWithoutValidation(model, value)
      const expectedError = [{ expected: 'enum ("one" | "two" | "three")', got: value, path: path.empty() }]
      checkError(result, expectedError)
    })
  })

  describe('optional value', () => {
    const model = types.number().optional()

    test('decodes null as undefined', () => {
      checkValue(decoder.decodeWithoutValidation(model, null), undefined)
    })

    test('decodes undefined as undefined', () => {
      checkValue(decoder.decodeWithoutValidation(model, undefined), undefined)
    })

    test('decodes wrapped type', () => {
      checkValue(decoder.decodeWithoutValidation(model, 1), 1)
    })

    test.prop([nonNumber.filter((n) => n !== null && n !== undefined)])('fails on other values', (value) => {
      const result = decoder.decodeWithoutValidation(model, value)
      const expectedError = [{ expected: 'number or undefined', got: value, path: path.empty() }]
      checkError(result, expectedError)
    })
  })

  describe('nullable value', () => {
    const model = types.number().nullable()

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test('decodes null as null', () => {
        checkValue(decoder.decodeWithoutValidation(model, null, options), null)
      })

      test('decodes wrapped type', () => {
        checkValue(decoder.decodeWithoutValidation(model, 1, options), 1)
      })

      test.prop([nonNumber.filter((n) => n !== null)])('fails on other values', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'number or null', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode undefined as null', () => {
        checkValue(decoder.decodeWithoutValidation(model, undefined, options), null)
      })
    })
  })

  describe('reference value', () => {
    const model = types.number().reference()
    test('decodes wrapped type', () => {
      checkValue(decoder.decodeWithoutValidation(model, 1), 1)
    })
  })

  describe('array value', () => {
    const model = types.number().array()

    describe('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      test.prop([gen.array(number)])('decodes an array of values', (array) => {
        checkValue(decoder.decodeWithoutValidation(model, array, options), array)
      })

      test.prop([nonArray])('fails with non arrays', (value) => {
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'array', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test('stops at first error by default', () => {
        const value = [0, 1, 'error1', 'error2']
        const result = decoder.decodeWithoutValidation(model, value, options)
        const expectedError = [{ expected: 'number', got: 'error1', path: path.empty().prependIndex(2) }]
        checkError(result, expectedError)
      })

      describe('when reportingAllErrors', () => {
        const options = { typeCastingStrategy: 'expectExactTypes', errorReportingStrategy: 'allErrors' } as const
        test('reports all errors', () => {
          const value = [0, 1, 'error1', 'error2']
          const result = decoder.decodeWithoutValidation(model, value, options)
          const expectedError = [
            { expected: 'number', got: 'error1', path: path.empty().prependIndex(2) },
            { expected: 'number', got: 'error2', path: path.empty().prependIndex(3) },
          ]
          checkError(result, expectedError)
        })
      })
    })

    describe('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode array-like object with numeric keys', () => {
        const object = { 1: 11, 0: 10, 2: 12 }
        const result = decoder.decodeWithoutValidation(model, object, options)
        checkValue(result, [10, 11, 12])
      })

      test('can decode array-like object with numeric string keys', () => {
        const object = { '1': 11, '0': 10, '2': 12 }
        const result = decoder.decodeWithoutValidation(model, object, options)
        checkValue(result, [10, 11, 12])
      })

      test('fails on non array-like objects', () => {
        const failingObjects = [{}, { 0: 10, 2: 12 }, { 1: 11, 2: 12 }, { notNumber: 10 }]
        for (const object of failingObjects) {
          const result = decoder.decodeWithoutValidation(model, object, options)
          const expectedError = [{ expected: 'array', got: object, path: path.empty() }]
          checkError(result, expectedError)
        }
      })

      test('reports errors with correct indices', () => {
        const object = { 1: 11, 0: 10, 2: 'error' }
        const result = decoder.decodeWithoutValidation(model, object, options)
        const expectedError = [{ expected: 'number', got: 'error', path: path.empty().prependIndex(2) }]
        checkError(result, expectedError)
      })
    })
  })
})

describe('decoder.decode', () => {
  test.todo('should perform validation', () => {})
})
