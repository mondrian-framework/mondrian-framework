import { arbitrary, path, result, types, validator } from '../src'
import { areSameArray } from '../src/utils'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

/**
 * Check if the result is a validator error that has the given got and
 * path. We do not check the error message as here it is not relevant and may
 * be changing quite frequently.
 */
function checkError(result: validator.Result, expected: { got: unknown; path: path.Path }[]): void {
  const error = assertFailure(result)
  const isExpectedError = compareValidatorErrors(error, expected)
  expect(isExpectedError).toBe(true)
}

function compareValidatorErrors(one: validator.Error[], other: { got: unknown; path: path.Path }[]): boolean {
  const compareSingleErrors = (one: { got: unknown; path: path.Path }, other: { got: unknown; path: path.Path }) => {
    const gotAreEqual = one.got === other.got || (Number.isNaN(one.got) && Number.isNaN(other.got))
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

const alwaysSuccess = types.custom('alwaysSuccess', mockEncode, mockDecode, () => validator.succeed())
const alwaysFail = types.custom('alwaysFail', mockEncode, mockDecode, (value) => validator.fail('test', value))

describe('validator.validate', () => {
  describe('on number types', () => {
    test.prop([gen.double()])('always succeeds if given no options', (n) => {
      assertOk(validator.validate(types.number, n))
    })

    describe('checks the number is >= than its minimum', () => {
      const minimum = 11
      const model = types.number({ minimum })

      const validValue = gen.double({ min: minimum, minExcluded: false, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(validator.validate(model, number))
      })

      const invalidValue = gen.double({ max: minimum, maxExcluded: true })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(validator.validate(model, number), expectedError)
      })
    })

    describe('checks the number is > than its excluding minimum', () => {
      const exclusiveMinimum = 11
      const model = types.number({ exclusiveMinimum })

      const validValue = gen.double({ min: exclusiveMinimum, minExcluded: true, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(validator.validate(model, number))
      })

      const invalidValue = gen.double({ max: exclusiveMinimum, maxExcluded: false })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(validator.validate(model, number), expectedError)
      })
    })

    describe('checks the number is <= than its maximum', () => {
      const maximum = 11
      const model = types.number({ maximum })

      const validValue = gen.double({ max: maximum, maxExcluded: false, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(validator.validate(model, number))
      })

      const invalidValue = gen.double({ min: maximum, minExcluded: true })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(validator.validate(model, number), expectedError)
      })
    })

    describe('checks the number is < than its exclusive maximum', () => {
      const exclusiveMaximum = 11
      const model = types.number({ exclusiveMaximum })

      const validValue = gen.double({ max: exclusiveMaximum, maxExcluded: true, noNaN: true })
      test.prop([validValue])('ok cases', (number) => {
        assertOk(validator.validate(model, number))
      })

      const invalidValue = gen.double({ min: exclusiveMaximum, minExcluded: false })
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(validator.validate(model, number), expectedError)
      })
    })

    describe('checks the number is an integer', () => {
      const model = types.number({ isInteger: true })

      const validValue = gen.integer()
      test.prop([validValue])('ok cases', (number) => {
        assertOk(validator.validate(model, number))
      })

      const invalidValue = gen.double().filter((n) => !Number.isInteger(n))
      test.prop([invalidValue])('failing cases', (number) => {
        const expectedError = [{ got: number, path: path.empty() }]
        checkError(validator.validate(model, number), expectedError)
      })
    })
  })

  describe('on string types', () => {
    test.prop([gen.string()])('always succeeds when given no options', (string) => {
      assertOk(validator.validate(types.string(), string))
    })

    describe('checks the string matches the given regex', () => {
      const model = types.string({ regex: /^mondrian/ })

      const validValue = gen.string().map((s) => 'mondrian' + s)
      test.prop([validValue])('ok cases', (string) => {
        assertOk(validator.validate(model, string))
      })

      const invalidValue = gen.string().filter((s) => !s.startsWith('mondrian'))
      test.prop([invalidValue])('failing cases', (string) => {
        const expectedError = [{ got: string, path: path.empty() }]
        checkError(validator.validate(model, string), expectedError)
      })
    })

    describe('checks the string has the minimum length', () => {
      const minLength = 3
      const model = types.string({ minLength })

      const validValue = gen.string({ minLength })
      test.prop([validValue])('ok cases', (string) => {
        assertOk(validator.validate(model, string))
      })

      const invalidValue = gen.string({ maxLength: minLength - 1 })
      test.prop([invalidValue])('failing cases', (string) => {
        const expectedError = [{ got: string, path: path.empty() }]
        checkError(validator.validate(model, string), expectedError)
      })
    })

    describe('checks the string has the maximum length', () => {
      const maxLength = 3
      const model = types.string({ maxLength })

      const validValue = gen.string({ maxLength })
      test.prop([validValue])('ok cases', (string) => {
        assertOk(validator.validate(model, string))
      })

      const invalidValue = gen.string({ minLength: maxLength + 1 })
      test.prop([invalidValue])('failing cases', (string) => {
        const expectedError = [{ got: string, path: path.empty() }]
        checkError(validator.validate(model, string), expectedError)
      })
    })
  })

  describe('on boolean types', () => {
    test.prop([arbitrary.boolean()])('always succeeds', (model) => {
      assertOk(validator.validate(model, true))
      assertOk(validator.validate(model, false))
    })
  })

  describe('on enum types', () => {
    const variants = ['one', 'two', 'three'] as const
    test.prop([arbitrary.enumeration(gen.constant(variants))])('always succeeds', (model) => {
      assertOk(validator.validate(model, 'one'))
      assertOk(validator.validate(model, 'two'))
      assertOk(validator.validate(model, 'three'))
    })
  })

  describe('on literal types', () => {
    const literalValue = gen.oneof(gen.string(), gen.boolean(), gen.integer(), gen.float(), gen.constant(null))
    test.prop([arbitrary.literal(literalValue)])('always succeeds', (model) => {
      assertOk(validator.validate(model, model.literalValue))
    })
  })

  describe('on optional types', () => {
    test.prop([gen.anything().filter((value) => value !== undefined)])('validates the inner type', (value) => {
      assertOk(validator.validate(alwaysSuccess.optional(), value))
      checkError(validator.validate(alwaysFail.optional(), value), [{ got: value, path: path.empty() }])
    })

    test('always succeeds on undefined', () => {
      assertOk(validator.validate(alwaysSuccess.optional(), undefined))
      assertOk(validator.validate(alwaysFail.optional(), undefined))
    })
  })

  describe('on nullable types', () => {
    test.prop([gen.anything().filter((value) => value !== null)])('validates the inner type', (value) => {
      assertOk(validator.validate(alwaysSuccess.nullable(), value))
      checkError(validator.validate(alwaysFail.nullable(), value), [{ got: value, path: path.empty() }])
    })

    test('always succeeds on null', () => {
      assertOk(validator.validate(alwaysSuccess.nullable(), null))
      assertOk(validator.validate(alwaysFail.nullable(), null))
    })
  })

  describe('on reference types', () => {
    test.prop([gen.anything()])('validates the inner type', (value) => {
      assertOk(validator.validate(alwaysSuccess.reference(), value))
      checkError(validator.validate(alwaysFail.reference(), value), [{ got: value, path: path.empty() }])
    })
  })

  describe('on array types', () => {
    test.todo('validates its items', () => {})

    test.todo('stops at first error by default', () => {})

    describe('when reporting all errors', () => {
      test.todo('reports all the errors with its items', () => {})
    })
  })

  describe('on object types', () => {
    test.todo('validates its fields', () => {})

    test.todo('stops at first error by default', () => {})

    describe('when reporting all errors', () => {
      test.todo('reports all the errors with its fields', () => {})
    })
  })

  describe.todo('on union types', () => {})

  describe.todo('on custom types', () => {})
})