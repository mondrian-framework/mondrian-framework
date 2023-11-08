import { arbitrary, decoding, path, types, validation } from '../src'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { areSameArray } from '@mondrian-framework/utils'
import { describe, expect, vi } from 'vitest'

/**
 * Check if the result is a validator error that has the given got and
 * path. We do not check the error message as here it is not relevant and may
 * be changing quite frequently.
 */
function checkError(result: validation.Result, expected: { got: unknown; path: path.Path }[]): void {
  const error = assertFailure(result)
  const isExpectedError = compareValidatorErrors(error, expected)
  expect(isExpectedError).toBe(true)
}

function compareValidatorErrors(one: validation.Error[], other: { got: unknown; path: path.Path }[]): boolean {
  const compareSingleErrors = (one: { got: unknown; path: path.Path }, other: { got: unknown; path: path.Path }) => {
    const gotAreEqual =
      one.got === other.got ||
      (Number.isNaN(one.got) && Number.isNaN(other.got)) ||
      (one.got instanceof Date &&
        other.got instanceof Date &&
        (other.got.getTime() === one.got.getTime() ||
          (Number.isNaN(other.got.getTime()) && Number.isNaN(one.got.getTime()))))
    const pathsAreEqual = one.path.equals(other.path)
    return gotAreEqual && pathsAreEqual
  }
  const mappedOne = one.map((error) => ({ got: error.got, path: error.path }))
  return areSameArray(mappedOne, other, compareSingleErrors)
}

const mockEncode = () => {
  throw 'test'
}
const mockDecode = () => {
  throw 'test'
}
const mockGenerator = () => {
  throw 'test'
}

const alwaysSuccess = types.custom(
  'alwaysSuccess',
  mockEncode,
  (v) => decoding.succeed(v),
  () => validation.succeed(),
  mockGenerator,
)
const alwaysFail = types.custom(
  'alwaysFail',
  mockEncode,
  (v) => decoding.succeed(v),
  (value) => validation.fail('test', value),
  mockGenerator,
)

describe.concurrent('errorToString', () => {
  test('prints the error and its path', () => {
    const error = { assertion: 'assertion', got: '1', path: path.empty() }
    expect(validation.errorToString(error)).toEqual('assertion: assertion, got: 1, path: $')
  })
})

describe.concurrent('validation.validate', () => {
  describe.concurrent('on number types', () => {
    test.prop([gen.double()])('always succeeds if given no options', (n) => {
      assertOk(types.number().validate(n))
    })

    describe.concurrent('checks the number is >= than its minimum', () => {
      const minimum = 11
      const model = types.number({ minimum })

      const validValue = gen.double({ min: minimum, minExcluded: false, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.double({ max: minimum, maxExcluded: true })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(model.validate(number), expectedError)
      })
    })

    describe.concurrent('checks the number is > than its excluding minimum', () => {
      const exclusiveMinimum = 11
      const model = types.number({ exclusiveMinimum })

      const validValue = gen.double({ min: exclusiveMinimum, minExcluded: true, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.double({ max: exclusiveMinimum, maxExcluded: false })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(model.validate(number), expectedError)
      })
    })

    describe.concurrent('checks the number is <= than its maximum', () => {
      const maximum = 11
      const model = types.number({ maximum })

      const validValue = gen.double({ max: maximum, maxExcluded: false, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.double({ min: maximum, minExcluded: true })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(model.validate(number), expectedError)
      })
    })

    describe.concurrent('checks the number is < than its exclusive maximum', () => {
      const exclusiveMaximum = 11
      const model = types.number({ exclusiveMaximum })

      const validValue = gen.double({ max: exclusiveMaximum, maxExcluded: true, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.double({ min: exclusiveMaximum, minExcluded: false })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(model.validate(number), expectedError)
      })
    })

    describe.concurrent('checks the number is an integer', () => {
      const model = types.number({ isInteger: true })

      const validValue = gen.integer()
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.double().filter((n) => !Number.isInteger(n))
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(model.validate(number), expectedError)
      })
    })
  })

  describe.concurrent('on string types', () => {
    test.prop([gen.string()])('always succeeds when given no options', (string) => {
      assertOk(types.string().validate(string))
    })

    describe.concurrent('checks the string matches the given regex', () => {
      const model = types.string({ regex: /^mondrian/ })

      const validValue = gen.string().map((s) => 'mondrian' + s)
      test.prop([validValue])('ok cases', (string) => {
        assertOk(model.validate(string))
      })

      const invalidValue = gen.string().filter((s) => !s.startsWith('mondrian'))
      test.prop([invalidValue])('failing cases', (string) => {
        const expectedError = [{ got: string, path: path.empty() }]
        checkError(model.validate(string), expectedError)
      })
    })

    describe.concurrent('checks the string has the minimum length', () => {
      const minLength = 3
      const model = types.string({ minLength })

      const validValue = gen.string({ minLength })
      test.prop([validValue])('ok cases', (string) => {
        assertOk(model.validate(string))
      })

      const invalidValue = gen.string({ maxLength: minLength - 1 })
      test.prop([invalidValue])('failing cases', (string) => {
        const expectedError = [{ got: string, path: path.empty() }]
        checkError(model.validate(string), expectedError)
      })
    })

    describe.concurrent('checks the string has the maximum length', () => {
      const maxLength = 3
      const model = types.string({ maxLength })

      const validValue = gen.string({ maxLength })
      test.prop([validValue])('ok cases', (string) => {
        assertOk(model.validate(string))
      })

      const invalidValue = gen.string({ minLength: maxLength + 1 })
      test.prop([invalidValue])('failing cases', (string) => {
        const expectedError = [{ got: string, path: path.empty() }]
        checkError(model.validate(string), expectedError)
      })
    })
  })

  describe.concurrent('on boolean types', () => {
    test.prop([arbitrary.boolean()])('always succeeds', (model) => {
      assertOk(model.validate(true))
      assertOk(model.validate(false))
    })
  })

  describe.concurrent('on enum types', () => {
    const variants = ['one', 'two', 'three'] as const
    test.prop([arbitrary.enumeration(gen.constant(variants))])('always succeeds', (model) => {
      assertOk(model.validate('one'))
      assertOk(model.validate('two'))
      assertOk(model.validate('three'))
    })
  })

  describe.concurrent('on literal types', () => {
    const literalValue = gen.oneof(gen.string(), gen.boolean(), gen.integer(), gen.float(), gen.constant(null))
    test.prop([arbitrary.literal(literalValue)])('always succeeds', (model) => {
      assertOk(model.validate(model.literalValue))
    })
  })

  describe.concurrent('on datetime types', () => {
    test.prop([gen.date()])('always succeeds if given no options', (date) => {
      assertOk(types.datetime().validate(date))
    })

    describe.concurrent('checks the datetime is >= than its minimum', () => {
      const minimum = new Date()
      const model = types.datetime({ minimum })

      const validValue = gen.date({ min: minimum })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.date({ max: new Date(minimum.getTime() - 1) })
      test.prop([invalidValue])('failing cases', (date) => {
        const expectedError = [{ got: date, path: path.empty() }]
        checkError(model.validate(date), expectedError)
      })
      checkError(model.validate(new Date('')), [{ got: new Date(''), path: path.empty() }])
    })

    describe.concurrent('checks the datetime is <= than its maximum', () => {
      const maximum = new Date()
      const model = types.datetime({ maximum })

      const validValue = gen.date({ max: maximum })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.date({ min: new Date(maximum.getTime() + 1) })
      test.prop([invalidValue])('failing cases', (date) => {
        const expectedError = [{ got: date, path: path.empty() }]
        checkError(model.validate(date), expectedError)
      })
      checkError(model.validate(new Date('')), [{ got: new Date(''), path: path.empty() }])
    })
  })

  describe.concurrent('on timestamp types', () => {
    test.prop([gen.date()])('always succeeds if given no options', (date) => {
      assertOk(types.timestamp().validate(date))
    })

    describe.concurrent('checks the datetime is >= than its minimum', () => {
      const minimum = new Date()
      const model = types.timestamp({ minimum })

      const validValue = gen.date({ min: minimum })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.date({ max: new Date(minimum.getTime() - 1) })
      test.prop([invalidValue])('failing cases', (date) => {
        const expectedError = [{ got: date, path: path.empty() }]
        checkError(model.validate(date), expectedError)
      })
      checkError(model.validate(new Date('')), [{ got: new Date(''), path: path.empty() }])
    })

    describe.concurrent('checks the datetime is <= than its maximum', () => {
      const maximum = new Date()
      const model = types.timestamp({ maximum })

      const validValue = gen.date({ max: maximum })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(model.validate(number))
      })

      const invalidValue = gen.date({ min: new Date(maximum.getTime() + 1) })
      test.prop([invalidValue])('failing cases', (date) => {
        const expectedError = [{ got: date, path: path.empty() }]
        checkError(model.validate(date), expectedError)
      })
      checkError(model.validate(new Date('')), [{ got: new Date(''), path: path.empty() }])
    })
  })

  describe.concurrent('on unknown types', () => {
    const model = types.unknown()
    test.prop([gen.anything()])('always succeeds on anything', (anything) => {
      assertOk(model.validate(anything))
    })
  })

  describe.concurrent('on never types', () => {
    const model = types.never()
    test.prop([gen.anything()])('never succeeds on anything', (anything) => {
      expect(() => model.validate(anything as never)).toThrowError()
    })
  })

  describe.concurrent('on record types', () => {
    const model = types.record(types.number({ minimum: 20, maximum: 30 }))
    test.prop([
      gen.array(gen.tuple(gen.string(), gen.double({ min: 0, max: 10 })), { minLength: 1 }).map(Object.fromEntries),
    ])('always fails on wrong record fields', (record) => {
      const result = model.validate(record)
      expect(!result.isOk && result.error.length).toBe(1)
      const result1 = model.validate(record, { errorReportingStrategy: 'allErrors' })
      expect(!result1.isOk && result1.error.length).toBe(Object.keys(record).length)
    })
  })

  describe.concurrent('on optional types', () => {
    test.prop([gen.anything().filter((value) => value !== undefined)])('validates the inner type', (value) => {
      assertOk(alwaysSuccess.optional().validate(value))
      checkError(alwaysFail.optional().validate(value), [{ got: value, path: path.empty() }])
    })

    test('always succeeds on undefined', () => {
      assertOk(alwaysSuccess.optional().validate(undefined))
      assertOk(alwaysFail.optional().validate(undefined))
    })
  })

  describe.concurrent('on nullable types', () => {
    test.prop([gen.anything().filter((value) => value !== null)])('validates the inner type', (value) => {
      assertOk(alwaysSuccess.nullable().validate(value))
      checkError(alwaysFail.nullable().validate(value), [{ got: value, path: path.empty() }])
    })

    test('always succeeds on null', () => {
      assertOk(alwaysSuccess.nullable().validate(null))
      assertOk(alwaysFail.nullable().validate(null))
    })
  })

  describe.concurrent('on array types', () => {
    test.prop([gen.array(gen.anything())])('validates its items', (array) => {
      assertOk(alwaysSuccess.array().validate(array))
    })

    test.prop([gen.array(gen.anything(), { minLength: 1 })])('stops at first error by default', (array) => {
      checkError(alwaysFail.array().validate(array), [{ got: array[0], path: path.empty().prependIndex(0) }])
    })

    describe.concurrent('checks min length', () => {
      const minItems = 4
      const model = types.array(alwaysSuccess, { minItems })

      const validValue = gen.array(gen.anything(), { minLength: minItems })
      test.prop([validValue])('valid values', (value) => {
        assertOk(model.validate(value))
      })

      const invalidValue = gen.array(gen.anything(), { maxLength: minItems - 1 })
      test.prop([invalidValue])('invalid values', (invalidValue) => {
        checkError(model.validate(invalidValue), [{ got: invalidValue, path: path.empty() }])
      })
    })

    describe.concurrent('checks max length', () => {
      const maxItems = 4
      const model = types.array(alwaysSuccess, { maxItems })

      const validValue = gen.array(gen.anything(), { maxLength: maxItems })
      test.prop([validValue])('valid values', (value) => {
        assertOk(model.validate(value))
      })

      const invalidValue = gen.array(gen.anything(), { minLength: maxItems + 1 })
      test.prop([invalidValue])('invalid values', (invalidValue) => {
        checkError(model.validate(invalidValue), [{ got: invalidValue, path: path.empty() }])
      })
    })

    describe.concurrent('when reporting all errors', () => {
      const options = { errorReportingStrategy: 'allErrors' } as const
      const toErrors = (array: any[]) =>
        array.map((value, index) => ({ got: value, path: path.empty().prependIndex(index) }))

      test.prop([gen.array(gen.anything(), { minLength: 1 })])('reports all the errors with its items', (array) => {
        checkError(alwaysFail.array().validate(array, options), toErrors(array))
      })

      test.prop([gen.array(gen.anything(), { maxLength: 4 })])(
        'reports both errors on min length and on single values',
        (array) => {
          const model = types.array(alwaysFail, { minItems: 5 })
          const errors = toErrors(array)
          errors.unshift({ got: array, path: path.empty() })
          checkError(model.validate(array, options), errors)
        },
      )

      test.prop([gen.array(gen.anything(), { minLength: 4 })])(
        'reports both errors on max length and on single values',
        (array) => {
          const model = types.array(alwaysFail, { maxItems: 3 })
          const errors = toErrors(array)
          errors.unshift({ got: array, path: path.empty() })
          checkError(model.validate(array, options), errors)
        },
      )
    })
  })

  describe.concurrent('on object types', () => {
    const objectGenerator = gen.record({ field1: gen.anything(), field2: gen.anything() })

    test.prop([objectGenerator])('validates its fields', (object) => {
      const model = types.object({ field1: alwaysSuccess, field2: alwaysSuccess })
      assertOk(model.validate(object))
    })

    test.prop([objectGenerator])('stops at first error by default', (object) => {
      const model = types.object({ field1: alwaysFail, field2: alwaysFail })
      const expectedError = [{ got: object.field1, path: path.empty().prependField('field1') }]
      checkError(model.validate(object), expectedError)
    })

    describe.concurrent('when reporting all errors', () => {
      const options = { errorReportingStrategy: 'allErrors' } as const

      test.prop([objectGenerator])('reports all the errors with its fields', (object) => {
        const model = types.object({ field1: alwaysFail, field2: alwaysFail })
        const expectedError = [
          { got: object.field1, path: path.empty().prependField('field1') },
          { got: object.field2, path: path.empty().prependField('field2') },
        ]
        checkError(model.validate(object, options), expectedError)
      })
    })
  })

  describe.concurrent('on union types', () => {
    test.prop([gen.anything()])('succeeds if variant is valid', (value) => {
      const model = types.union({ variant1: alwaysSuccess, variant2: alwaysFail })
      assertOk(model.validate(value))
    })

    test.prop([gen.anything()])('fails is variant is invalid', (value) => {
      const model = types.union({ variant1: alwaysFail, variant2: alwaysFail })
      const expectedError = [{ got: value, path: path.empty() }]
      checkError(model.validate(value), expectedError)
    })
  })

  describe.concurrent('on custom types', () => {
    const options = { errorReportingStrategy: 'allErrors' } as const

    test.prop([gen.anything()])('calls the provided decoder', (value) => {
      // spy function: https://vitest.dev/api/expect.html#tohavebeencalled
      const validationFunction = {
        validate: (v: unknown, o: any) => {
          expect(v).toEqual(value)
          expect(o).toEqual(options)
          return validation.succeed()
        },
      }
      const validationSpy = vi.spyOn(validationFunction, 'validate')
      const model = types.custom('custom', mockEncode, mockDecode, validationFunction.validate, mockGenerator)
      assertOk(model.validate(value, options))
      expect(validationSpy).toHaveBeenCalledTimes(1)
    })
  })
})
