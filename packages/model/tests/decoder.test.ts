import { decoding, types, path, validation, result } from '../src'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { areSameArray } from '@mondrian-framework/utils'
import { describe, expect, vi } from 'vitest'

function compareDecoderErrors(one: decoding.Error[], other: decoding.Error[]): boolean {
  const compareSingleErrors = (one: decoding.Error, other: decoding.Error) => {
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
const nonObject = gen.anything().filter((value) => !(typeof value === 'object'))
const nonDate = gen
  .anything()
  .filter(
    (value) => !(value instanceof Date || (typeof value === 'string' && !Number.isNaN(new Date(value).valueOf()))),
  )
const nonTimestamp = gen
  .anything()
  .filter(
    (value) =>
      (typeof value !== 'number' || value > 8640000000000000 || value < -8640000000000000) && !(value instanceof Date),
  )

export function checkError(result: decoding.Result<any>, expectedError: decoding.Error[]): void {
  const error = assertFailure(result)
  const isExpectedError = compareDecoderErrors(error, expectedError)
  expect(isExpectedError).toBe(true)
}

export function checkValue<A>(result: result.Result<A, any>, expectedValue: A): void {
  const value = assertOk(result)
  expect(value).toEqual(expectedValue)
}

describe.concurrent('decoding.decodeWithoutValidation', () => {
  describe.concurrent('boolean value', () => {
    const model = types.boolean()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonBoolean])('fails on non booleans', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'boolean', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([gen.boolean()])('can decode booleans', (boolean) => {
        const result = model.decodeWithoutValidation(boolean, options)
        checkValue(result, boolean)
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode the strings "true" and "false"', () => {
        checkValue(model.decodeWithoutValidation('true', options), true)
        checkValue(model.decodeWithoutValidation('false', options), false)
      })

      test('decodes 0 as false', () => {
        checkValue(model.decodeWithoutValidation(0, options), false)
      })

      test.prop([number.filter((n) => n !== 0)])('decodes non-zero number as true', (n) => {
        checkValue(model.decodeWithoutValidation(n, options), true)
      })
    })
  })

  describe.concurrent('number value', () => {
    const model = types.number()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonNumber])('fails on non numbers', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'number', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([number])('can decode numbers', (n) => {
        checkValue(model.decodeWithoutValidation(n, options), n)
      })

      test('can decode NaN', () => {
        const result = model.decodeWithoutValidation(NaN, options)
        if (!result.isOk || !Number.isNaN(result.value)) {
          expect.fail('should work on NaN')
        }
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('works with +-0 strings', () => {
        checkValue(model.decodeWithoutValidation('+0', options), 0)
        checkValue(model.decodeWithoutValidation('-0', options), -0)
      })

      test.prop([number.filter((n) => n !== 0 && !Number.isNaN(n))])('can decode number strings', (n) => {
        checkValue(model.decodeWithoutValidation(n.toString(), options), n)
      })

      test('still fails with non number strings', () => {
        for (const value of ['foo', 'bar', '1.1 not a number']) {
          const result = model.decodeWithoutValidation(value, options)
          const expectedError = [{ expected: 'number', got: value, path: path.empty() }]
          checkError(result, expectedError)
        }
      })
    })
  })

  describe.concurrent('string value', () => {
    const model = types.string()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonString])('fails on non strings', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'string', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([gen.string()])('can decode strings', (string) => {
        checkValue(model.decodeWithoutValidation(string, options), string)
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test.prop([number])('can decode numbers as strings', (number) => {
        const result = model.decodeWithoutValidation(number, options)
        checkValue(result, number.toString())
      })

      test.prop([gen.boolean()])('can decode booleans as strings', (boolean) => {
        const result = model.decodeWithoutValidation(boolean, options)
        checkValue(result, boolean ? 'true' : 'false')
      })
    })
  })

  describe.concurrent('literal value', () => {
    describe.concurrent('literal number', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const literalValue = 1
      const model = types.literal(literalValue)

      test('can decode the exact same literal', () => {
        checkValue(model.decodeWithoutValidation(literalValue, options), literalValue)
      })

      test.prop([number.filter((n) => n !== literalValue)])('fails on numbers that are not the literal', (n) => {
        const result = model.decodeWithoutValidation(n, options)
        const expectedError = [{ expected: 'literal (1)', got: n, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([nonNumber])('fails on non number values', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'literal (1)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe.concurrent('literal string', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const literalValue = 'mondrian'
      const model = types.literal(literalValue)

      test('can decode the exact same literal', () => {
        checkValue(model.decodeWithoutValidation(literalValue, options), literalValue)
      })

      test.prop([gen.string().filter((s) => s !== literalValue)])(
        'fails on strings that are not the literal',
        (string) => {
          const result = model.decodeWithoutValidation(string, options)
          const expectedError = [{ expected: 'literal (mondrian)', got: string, path: path.empty() }]
          checkError(result, expectedError)
        },
      )

      test.prop([nonString])('fail on non string values', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'literal (mondrian)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe.concurrent('literal boolean', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      const literalValue = true
      const model = types.literal(literalValue)

      test('can decode the exact same literal', () => {
        checkValue(model.decodeWithoutValidation(literalValue, options), literalValue)
      })

      test.prop([gen.boolean().filter((b) => b !== literalValue)])(
        'fails on booleans that are not the literal',
        (boolean) => {
          const result = model.decodeWithoutValidation(boolean, options)
          const expectedError = [{ expected: 'literal (true)', got: boolean, path: path.empty() }]
          checkError(result, expectedError)
        },
      )

      test.prop([nonBoolean])('fails on non boolean values', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'literal (true)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe.concurrent('literal null', () => {
      const literalValue = null
      const model = types.literal(literalValue)

      describe.concurrent('without casting', () => {
        const options = { typeCastingStrategy: 'expectExactTypes' } as const

        test('can decode the exact same literal', () => {
          checkValue(model.decodeWithoutValidation(literalValue, options), literalValue)
        })

        test.prop([nonNull])('fails on non null values', (value) => {
          const result = model.decodeWithoutValidation(value, options)
          const expectedError = [{ expected: 'literal (null)', got: value, path: path.empty() }]
          checkError(result, expectedError)
        })
      })

      describe.concurrent('with casting', () => {
        const options = { typeCastingStrategy: 'tryCasting' } as const

        test('can decode the "null" string as the null literal', () => {
          checkValue(model.decodeWithoutValidation('null', options), null)
        })

        test.prop([gen.string().filter((s) => s !== 'null')])('fails on other strings', (string) => {
          const result = model.decodeWithoutValidation(string, options)
          const expectedError = [{ expected: 'literal (null)', got: string, path: path.empty() }]
          checkError(result, expectedError)
        })
      })
    })
  })

  describe.concurrent('enum variant', () => {
    const variants = ['one', 'two', 'three'] as const
    const model = types.enumeration(variants)

    test.prop([gen.constantFrom(...variants)])('can decode its variants', (variant) => {
      checkValue(model.decodeWithoutValidation(variant), variant)
    })

    const nonVariant = gen.string().filter((s) => !(variants as readonly string[]).includes(s))
    test.prop([nonVariant])('fails on non variant strings', (string) => {
      const result = model.decodeWithoutValidation(string)
      const expectedError = [{ expected: 'enum ("one" | "two" | "three")', got: string, path: path.empty() }]
      checkError(result, expectedError)
    })

    test.prop([nonString])('fails on non strings', (value) => {
      const result = model.decodeWithoutValidation(value)
      const expectedError = [{ expected: 'enum ("one" | "two" | "three")', got: value, path: path.empty() }]
      checkError(result, expectedError)
    })
  })

  describe.concurrent('datetime value', () => {
    const model = types.dateTime()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonDate])('fails on non dates', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'ISO date', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
      test.prop([
        gen.oneof(
          gen.date(),
          gen.date().map((d) => d.toISOString()),
        ),
      ])('can decode dates', (date) => {
        const result = model.decodeWithoutValidation(date, options)
        checkValue(result, typeof date === 'string' ? new Date(date) : date)
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const
      test.prop([
        gen.oneof(
          gen.date(),
          gen.date().map((d) => d.toISOString()),
          gen.date().map((d) => d.getTime().toString()),
          gen.date().map((d) => d.getTime()),
        ),
      ])('can decode unixtime', (date) => {
        const result = model.decodeWithoutValidation(date, options)
        checkValue(
          result,
          date instanceof Date
            ? date
            : typeof date === 'number'
            ? new Date(date)
            : Number.isNaN(Number(date))
            ? new Date(date)
            : new Date(Number(date)),
        )
      })
    })
  })

  describe.concurrent('timestamp value', () => {
    const model = types.timestamp()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonTimestamp])('fails on non timestamp', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'timestamp', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([
        gen.oneof(
          gen.date(),
          gen.date().map((d) => d.getTime()),
        ),
      ])('can decode dates', (date) => {
        const result = model.decodeWithoutValidation(date, options)
        checkValue(result, typeof date === 'number' ? new Date(date) : date)
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test.prop([
        gen.oneof(
          gen.date(),
          gen.date().map((d) => d.toISOString()),
          gen.date().map((d) => d.getTime().toString()),
          gen.date().map((d) => d.getTime()),
        ),
      ])('can decode unixtime', (date) => {
        const result = model.decodeWithoutValidation(date, options)
        checkValue(
          result,
          date instanceof Date
            ? date
            : typeof date === 'number'
            ? new Date(date)
            : Number.isNaN(Number(date))
            ? new Date(date)
            : new Date(Number(date)),
        )
      })
    })
  })

  describe.concurrent('unknown value', () => {
    const model = types.unknown()
    test.prop([gen.anything()])('can always decode anything', (anything) => {
      const result = model.decodeWithoutValidation(anything)
      checkValue(result, anything)
    })
  })

  describe.concurrent('never value', () => {
    const model = types.never()
    test.prop([gen.anything()])('can never decode anything', (anything) => {
      expect(() => model.decodeWithoutValidation(anything)).toThrowError()
    })
  })

  describe.concurrent('record value', () => {
    const model = types.record(types.number())
    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test.prop([nonObject])('fails on non object', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'object', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test.prop([gen.array(gen.tuple(gen.string(), nonNumber), { minLength: 1 }).map(Object.fromEntries)])(
        'fails on records of non number',
        (value) => {
          const result = model.decodeWithoutValidation(value, options)
          expect(!result.isOk && result.error[0].expected).toBe('number')
        },
      )

      test.prop([gen.array(gen.tuple(gen.string(), nonNumber), { minLength: 1 }).map(Object.fromEntries)])(
        'fails on records of non number with every error',
        (value) => {
          const result = model.decodeWithoutValidation(value, { errorReportingStrategy: 'allErrors', ...options })
          expect(!result.isOk && result.error[0].expected).toBe('number')
          expect(!result.isOk && result.error.length).toBe(Object.keys(value).length)
        },
      )

      test.prop([gen.array(gen.tuple(gen.string(), gen.double())).map(Object.fromEntries)])(
        'can decode records',
        (record) => {
          const result = model.decodeWithoutValidation(record, options)
          checkValue(result, record)
        },
      )
    })
  })

  describe.concurrent('optional value', () => {
    const model = types.number().optional()

    test('decodes null as undefined', () => {
      checkValue(model.decodeWithoutValidation(null), undefined)
    })

    test('decodes undefined as undefined', () => {
      checkValue(model.decodeWithoutValidation(undefined), undefined)
    })

    test('decodes wrapped type', () => {
      checkValue(model.decodeWithoutValidation(1), 1)
    })

    test.prop([nonNumber.filter((n) => n !== null && n !== undefined)])('fails on other values', (value) => {
      const result = model.decodeWithoutValidation(value)
      const expectedError = [{ expected: 'number or undefined', got: value, path: path.empty() }]
      checkError(result, expectedError)
    })
  })

  describe.concurrent('nullable value', () => {
    const model = types.number().nullable()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const

      test('decodes null as null', () => {
        checkValue(model.decodeWithoutValidation(null, options), null)
      })

      test('decodes wrapped type', () => {
        checkValue(model.decodeWithoutValidation(1, options), 1)
      })

      test.prop([nonNumber.filter((n) => n !== null)])('fails on other values', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'number or null', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode undefined as null', () => {
        checkValue(model.decodeWithoutValidation(undefined, options), null)
      })
    })
  })

  describe.concurrent('array value', () => {
    const model = types.number().array()

    describe.concurrent('without casting', () => {
      const options = { typeCastingStrategy: 'expectExactTypes' } as const
      test.prop([gen.array(number)])('decodes an array of values', (array) => {
        checkValue(model.decodeWithoutValidation(array, options), array)
      })

      test.prop([nonArray])('fails with non arrays', (value) => {
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'array', got: value, path: path.empty() }]
        checkError(result, expectedError)
      })

      test('stops at first error by default', () => {
        const value = [0, 1, 'error1', 'error2']
        const result = model.decodeWithoutValidation(value, options)
        const expectedError = [{ expected: 'number', got: 'error1', path: path.empty().prependIndex(2) }]
        checkError(result, expectedError)
      })

      describe.concurrent('when reportingAllErrors', () => {
        const options = { typeCastingStrategy: 'expectExactTypes', errorReportingStrategy: 'allErrors' } as const
        test('reports all errors', () => {
          const value = [0, 1, 'error1', 'error2']
          const result = model.decodeWithoutValidation(value, options)
          const expectedError = [
            { expected: 'number', got: 'error1', path: path.empty().prependIndex(2) },
            { expected: 'number', got: 'error2', path: path.empty().prependIndex(3) },
          ]
          checkError(result, expectedError)
        })
      })
    })

    describe.concurrent('with casting', () => {
      const options = { typeCastingStrategy: 'tryCasting' } as const

      test('can decode array-like object with numeric keys', () => {
        const object = { 1: 11, 0: 10, 2: 12 }
        const result = model.decodeWithoutValidation(object, options)
        checkValue(result, [10, 11, 12])
      })

      test('can decode array-like object with numeric string keys', () => {
        const object = { '1': 11, '0': 10, '2': 12 }
        const result = model.decodeWithoutValidation(object, options)
        checkValue(result, [10, 11, 12])
      })

      test('fails on non array-like objects', () => {
        const failingObjects = [{}, { 0: 10, 2: 12 }, { 1: 11, 2: 12 }, { notNumber: 10 }]
        for (const object of failingObjects) {
          const result = model.decodeWithoutValidation(object, options)
          const expectedError = [{ expected: 'array', got: object, path: path.empty() }]
          checkError(result, expectedError)
        }
      })

      test('reports errors with correct indices', () => {
        const object = { 1: 11, 0: 10, 2: 'error' }
        const result = model.decodeWithoutValidation(object, options)
        const expectedError = [{ expected: 'number', got: 'error', path: path.empty().prependIndex(2) }]
        checkError(result, expectedError)
      })
    })
  })

  describe.concurrent('object value', () => {
    const model = types.object({
      field1: types.number(),
      field2: types.number().optional(),
    })

    const validObject = gen.record(
      {
        field1: number,
        field2: number,
      },
      { requiredKeys: ['field1'] },
    )

    test.prop([validObject])('decodes its fields', (object) => {
      checkValue(model.decodeWithoutValidation(object), object)
    })

    test('fail when a required field is missing', () => {
      const object = { field2: 10 }
      const result = model.decodeWithoutValidation(object)
      const expectedError = [{ expected: 'number', got: undefined, path: path.empty().prependField('field1') }]
      checkError(result, expectedError)
    })

    test('fail when null is given instead of an empty object', () => {
      const object = null
      const result = types.object({}).decodeWithoutValidation(object)
      const expectedError = [{ expected: 'object', got: null, path: path.empty() }]
      checkError(result, expectedError)
    })

    test('works when null is given instead of an empty object while casting', () => {
      const object = null
      checkValue(types.object({}).decodeWithoutValidation(object, { typeCastingStrategy: 'tryCasting' }), {})
    })

    test('works when non required field is missing', () => {
      const object = { field1: 1 }
      checkValue(model.decodeWithoutValidation(object), object)
    })

    test('works with more than needed fields', () => {
      const object = { field1: 1, field3: 1 }
      checkValue(model.decodeWithoutValidation(object), { field1: 1 })
    })

    test('stops at first error by default', () => {
      const object = { field1: 'error1', field2: 'error2' }
      const result = model.decodeWithoutValidation(object)
      const expectedError = [{ expected: 'number', got: 'error1', path: path.empty().prependField('field1') }]
      checkError(result, expectedError)
    })

    test('treats null as an empty object', () => {
      const result = model.decodeWithoutValidation(null, { typeCastingStrategy: 'tryCasting' })
      const expectedError = [{ expected: 'number', got: undefined, path: path.empty().prependField('field1') }]
      checkError(result, expectedError)
    })

    test.prop([nonObject])('fails on non objects', (value) => {
      const result = model.decodeWithoutValidation(value)
      const expected = [{ expected: 'object', got: value, path: path.empty() }]
      checkError(result, expected)
    })

    describe.concurrent('when reporting all errors', () => {
      const options = { errorReportingStrategy: 'allErrors' } as const

      test('reports all errors in decoding its fields', () => {
        const object = { field1: 'error1', field2: 'error2' }
        const result = model.decodeWithoutValidation(object, options)
        const expectedError = [
          { expected: 'number', got: 'error1', path: path.empty().prependField('field1') },
          { expected: 'number or undefined', got: 'error2', path: path.empty().prependField('field2') },
        ]
        checkError(result, expectedError)
      })
    })
  })

  describe.concurrent('union value', () => {
    const model = types.union({ variant1: types.number(), variant2: types.string().optional() })

    test.prop([number.filter((n) => n % 2 === 0)])('can decode its tagged variant', (number) => {
      checkValue(model.decodeWithoutValidation({ variant1: number }), { variant1: number })
    })

    test.prop([gen.string()])('can decode its other tagged variant', (string) => {
      checkValue(model.decodeWithoutValidation({ variant2: string }), { variant2: string })
    })

    test('can decode its other missing variant', () => {
      checkValue(model.decodeWithoutValidation({ variant2: null }), { variant2: undefined })
    })

    test.prop([nonObject])('fails with something that is not an object', (value) => {
      const result = model.decodeWithoutValidation(value)
      const expectedError = [{ expected: 'union (variant1 | variant2)', got: value, path: path.empty() }]
      checkError(result, expectedError)
    })

    test('fails with objects that are not tagged as one of its unions', () => {
      const failingValues = [{}, { variant1: 1, variant2: 2 }, { notAVariant: 2 }]
      for (const value of failingValues) {
        const result = model.decodeWithoutValidation(value)
        const expectedError = [{ expected: 'union (variant1 | variant2)', got: value, path: path.empty() }]
        checkError(result, expectedError)
      }
    })

    test.prop([nonNumber])('fails if it cannot decode the variant wrapped type', (value) => {
      const result = model.decodeWithoutValidation({ variant1: value })
      const expectedError = [{ expected: 'number', got: value, path: path.empty().prependVariant('variant1') }]
      checkError(result, expectedError)
    })
  })

  describe.concurrent('custom type', () => {
    const options = {
      typeCastingStrategy: 'tryCasting',
      errorReportingStrategy: 'allErrors',
      unionDecodingStrategy: 'taggedUnions',
    } as const
    test.prop([gen.anything()])('calls the provided decoder', (value) => {
      // spy function: https://vitest.dev/api/expect.html#tohavebeencalled
      const decoderFunction = {
        decode: (v: unknown, o: any) => {
          expect(v).toEqual(value)
          expect(o).toEqual(options)
          return decoding.succeed(1)
        },
      }
      const decoderSpy = vi.spyOn(decoderFunction, 'decode')

      const model = types.custom<'custom', {}, number>(
        'custom',
        () => null,
        decoderFunction.decode,
        () => validation.fail('test', 'test'),
      )
      checkValue(model.decodeWithoutValidation(value, options), 1)
      expect(decoderSpy).toHaveBeenCalledTimes(1)
    })
  })
})

describe.concurrent('decoding.decode', () => {
  test.prop([gen.anything()])('should perform validation', (value) => {
    const options = { foo: 'bar', baz: 1 }
    const validationOptions = { errorReportingStrategy: 'allErrors' } as const
    const mocks = {
      encode: () => {
        throw 'test'
      },
      decode: (_: any) => decoding.succeed('decoded successfully'),
      validate: (innerValue: any, innerValidationOptions: any, innerOptions: any) => {
        expect(innerValue).toEqual('decoded successfully')
        expect(innerValidationOptions).toEqual(validationOptions)
        expect(innerOptions).toEqual(options)
        return validation.succeed()
      },
    }
    const validateSpy = vi.spyOn(mocks, 'validate')
    const decodeSpy = vi.spyOn(mocks, 'decode')
    const model = types.custom('test', mocks.encode, mocks.decode, mocks.validate, options)
    checkValue(model.decode(value, {}, validationOptions), 'decoded successfully')
    expect(validateSpy).toBeCalledTimes(1)
    expect(decodeSpy).toBeCalledTimes(1)
  })
})

describe.concurrent('datetime value', () => {
  const model = types.dateTime()
  test.prop([gen.date()])('can decode date', (date) => {
    checkValue(model.decodeWithoutValidation(date), date)
  })

  test.prop([gen.integer({ min: -8640000000000000, max: 8640000000000000 })])('can decode integer', (number) => {
    checkValue(model.decodeWithoutValidation(number, { typeCastingStrategy: 'tryCasting' }), new Date(number))
  })
})

describe.concurrent('timestamp value', () => {
  const model = types.timestamp()
  test.prop([gen.date()])('can decode date', (date) => {
    checkValue(model.decodeWithoutValidation(date), date)
  })

  test.prop([gen.integer({ min: -8640000000000000, max: 8640000000000000 })])('can decode integer', (number) => {
    checkValue(model.decodeWithoutValidation(number), new Date(number))
  })
})

describe.concurrent('record value', () => {
  const model = types.record(types.unknown())
  test.prop([gen.array(gen.tuple(gen.string(), gen.anything())).map(Object.fromEntries)])(
    'can decode record',
    (record) => {
      checkValue(model.decodeWithoutValidation(record), record)
    },
  )
})

describe.concurrent('errorToString', () => {
  test('prints the error and its path', () => {
    const error = { expected: 'expected', got: '1', path: path.empty() }
    expect(decoding.errorToString(error)).toEqual('expected: expected, got: 1, path: $')
  })
})
