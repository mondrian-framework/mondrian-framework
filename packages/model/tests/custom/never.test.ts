import { model, decoding, validation, path } from '../../src'
import { testWithArbitrary } from './property-helper'
import { describe, test, expect } from 'vitest'

describe('never type', () => {
  const neverType = model.never()

  describe('decoding', () => {
    test('always fails to decode any value', () => {
      const testValues = [null, undefined, 0, 1, '', 'test', true, false, {}, [], new Date()]

      for (const value of testValues) {
        const result = neverType.decodeWithoutValidation(value)
        expect(result.isFailure).toBe(true)
        if (result.isFailure) {
          expect(result.error[0].expected).toBe('never')
        }
      }
    })
  })

  describe('encoding', () => {
    test('throws when trying to encode', () => {
      // Since never type should never have a value, encoding should throw
      expect(() => {
        ;(neverType as any).encodeWithoutValidation('anything')
      }).toThrow('Tried encoding a never value')
    })
  })

  describe('validation', () => {
    test('always fails to validate any value', () => {
      const testValues = [null, undefined, 0, 1, '', 'test', true, false, {}, []]

      for (const value of testValues) {
        const result = neverType.validate(value as never)
        expect(result.isFailure).toBe(true)
        if (result.isFailure) {
          expect(result.error[0].assertion).toBe('Tried validating a never value')
        }
      }
    })
  })

  describe('arbitrary', () => {
    test('throws when trying to generate arbitrary value', () => {
      expect(() => {
        neverType.arbitrary(10)
      }).toThrow('Tried generating a never value')
    })
  })
})
