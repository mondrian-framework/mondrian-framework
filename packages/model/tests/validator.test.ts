import { arbitrary, path, result, validator } from '../src'
import { assertOk } from './testing-utils'
import { test } from '@fast-check/vitest'
import { describe } from 'vitest'

/**
 * Check if the result is a validator error that has the given got and
 * path. We do not check the error message as here it is not relevant and may
 * be changing quite frequently.
 */
function checkError(result: result.Result<any, validator.Error>, got: unknown, path: path.Path): void {}

describe('validator.validate', () => {
  describe('on number types', () => {
    test.todo('checks the number is >= than its minimum', () => {})
    test.todo('checks the number is > than its excluding minimum', () => {})
    test.todo('checks the number is <= than its maximum', () => {})
    test.todo('checks the number is < than its excluding maximum', () => {})
    test.todo('checks the number is a multiple of the provided multiple', () => {})
  })

  describe('on string types', () => {
    test.todo('checks the string matches the given regex', () => {})
    test.todo('checks the string has the minimum length', () => {})
    test.todo('checks the string has the maximum length', () => {})
  })

  describe('on boolean types', () => {
    test.prop([arbitrary.boolean()])('always succeeds', (model) => {
      assertOk(validator.validate(model, true))
      assertOk(validator.validate(model, false))
    })
  })

  describe('on enum types', () => {
    test.todo('always succeeds', () => {})
  })

  describe('on literal types', () => {
    test.todo('always succeeds', () => {})
  })

  describe('on optional types', () => {
    test.todo('validates the inner type', () => {})
  })

  describe('on nullable types', () => {
    test.todo('validates the inner type', () => {})
  })

  describe('on reference types', () => {
    test.todo('validates the wrapped type', () => {})
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
})
