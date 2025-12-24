import { exception, security } from '../src'
import { decoding, validation } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('Exception classes', () => {
  describe('InvalidInput', () => {
    test('should create InvalidInput from decoding errors', () => {
      const decodingErrors: decoding.Error[] = [
        { path: '$.field', expected: 'string', got: 123 },
        { path: '$.other', expected: 'number', got: 'abc' },
      ]
      const error = new exception.InvalidInput('input', decodingErrors)

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Invalid input.')
      expect(error.from).toBe('input')
      expect(error.errors).toEqual(decodingErrors)
    })

    test('should create InvalidInput from retrieve source', () => {
      const validationErrors: validation.Error[] = [{ path: '$.field', assertion: 'minLength', got: '' }]
      const error = new exception.InvalidInput('retrieve', validationErrors)

      expect(error.from).toBe('retrieve')
      expect(error.errors).toEqual(validationErrors)
    })

    test('should create InvalidInput with empty errors array', () => {
      const error = new exception.InvalidInput('input', [])
      expect(error.errors).toHaveLength(0)
    })
  })

  describe('UnauthorizedAccess', () => {
    test('should create UnauthorizedAccess with policy violation', () => {
      const policyViolation: security.PolicyViolation = {
        path: '$.secret',
        reasons: [
          {
            applicable: true,
            policy: { selection: { public: true } },
            forbiddenAccess: ['$.secret'],
          },
        ],
      }
      const error = new exception.UnauthorizedAccess(policyViolation)

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Unauthorized access.')
      expect(error.error).toEqual(policyViolation)
    })

    test('should create UnauthorizedAccess with empty reasons', () => {
      const policyViolation: security.PolicyViolation = {
        path: '$',
        reasons: [],
      }
      const error = new exception.UnauthorizedAccess(policyViolation)

      expect(error.error.reasons).toHaveLength(0)
    })
  })

  describe('InvalidOutputValue', () => {
    test('should create InvalidOutputValue with validation errors', () => {
      const errors: validation.Error[] = [{ path: '$.output.field', assertion: 'maxLength', got: 'very long string' }]
      const error = new exception.InvalidOutputValue('myFunction', errors)

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('Invalid output on function myFunction')
      expect(error.message).toContain('$.output.field')
      expect(error.errors).toEqual(errors)
    })

    test('should create InvalidOutputValue with decoding errors', () => {
      const errors: decoding.Error[] = [
        { path: '$.result', expected: 'string', got: 123 },
        { path: '$.data', expected: 'array', got: {} },
      ]
      const error = new exception.InvalidOutputValue('testFunc', errors)

      expect(error.message).toContain('(1)')
      expect(error.message).toContain('(2)')
      expect(error.errors).toHaveLength(2)
    })

    test('should create InvalidOutputValue with empty errors', () => {
      const error = new exception.InvalidOutputValue('emptyFunc', [])
      expect(error.message).toBe('Invalid output on function emptyFunc. Errors: ')
    })
  })

  describe('MaxSelectionDepthReached', () => {
    test('should create MaxSelectionDepthReached with depth info', () => {
      const error = new exception.MaxSelectionDepthReached(5, 3)

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('Max selection depth reached')
      expect(error.message).toContain('5')
      expect(error.message).toContain('3')
      expect(error.depth).toBe(5)
      expect(error.maxDepth).toBe(3)
    })

    test('should handle edge case depths', () => {
      const error1 = new exception.MaxSelectionDepthReached(1, 0)
      expect(error1.depth).toBe(1)
      expect(error1.maxDepth).toBe(0)

      const error2 = new exception.MaxSelectionDepthReached(100, 99)
      expect(error2.depth).toBe(100)
      expect(error2.maxDepth).toBe(99)
    })
  })
})
