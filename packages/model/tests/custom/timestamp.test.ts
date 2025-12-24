import { model, decoding, validation, path } from '../../src'
import { testTypeEncodingAndDecoding, testTypeDecodingAndEncoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe, test, expect } from 'vitest'

// Test basic timestamp functionality
describe('timestamp type', () => {
  describe('encoding', () => {
    test('encodes date as milliseconds by default', () => {
      const timestampType = model.timestamp()
      const date = new Date('2024-01-15T10:30:00.000Z')
      const encoded = timestampType.encodeWithoutValidation(date)
      expect(encoded).toBe(date.getTime())
    })

    test('encodes date as seconds when format is seconds', () => {
      const timestampType = model.timestamp({ format: 'seconds' })
      const date = new Date('2024-01-15T10:30:00.000Z')
      const encoded = timestampType.encodeWithoutValidation(date)
      expect(encoded).toBe(date.getTime() / 1000)
    })

    test('encodes date as milliseconds when format is milliseconds', () => {
      const timestampType = model.timestamp({ format: 'milliseconds' })
      const date = new Date('2024-01-15T10:30:00.000Z')
      const encoded = timestampType.encodeWithoutValidation(date)
      expect(encoded).toBe(date.getTime())
    })
  })

  describe('decoding', () => {
    test('decodes number as timestamp in milliseconds by default', () => {
      const timestampType = model.timestamp()
      const timestamp = Date.now()
      const result = timestampType.decodeWithoutValidation(timestamp)
      expect(result.isOk && result.value.getTime()).toBe(timestamp)
    })

    test('decodes number as timestamp in seconds when format is seconds', () => {
      const timestampType = model.timestamp({ format: 'seconds' })
      const timestampInSeconds = Math.floor(Date.now() / 1000)
      const result = timestampType.decodeWithoutValidation(timestampInSeconds)
      expect(result.isOk && result.value.getTime()).toBe(timestampInSeconds * 1000)
    })

    test('decodes Date object directly', () => {
      const timestampType = model.timestamp()
      const date = new Date()
      const result = timestampType.decodeWithoutValidation(date)
      expect(result.isOk && result.value).toEqual(date)
    })

    test('fails to decode invalid timestamp (out of range)', () => {
      const timestampType = model.timestamp()
      const invalidTimestamp = 9999999999999999 // Out of valid Date range
      const result = timestampType.decodeWithoutValidation(invalidTimestamp)
      expect(result.isFailure).toBe(true)
    })

    test('fails to decode non-number non-Date value without casting', () => {
      const timestampType = model.timestamp()
      const result = timestampType.decodeWithoutValidation('not a timestamp')
      expect(result.isFailure).toBe(true)
    })

    test('decodes string as timestamp with tryCasting', () => {
      const timestampType = model.timestamp()
      const timestamp = Date.now()
      const result = timestampType.decodeWithoutValidation(String(timestamp), { typeCastingStrategy: 'tryCasting' })
      expect(result.isOk && result.value.getTime()).toBe(timestamp)
    })

    test('decodes ISO date string with tryCasting', () => {
      const timestampType = model.timestamp()
      const dateStr = '2024-01-15T10:30:00.000Z'
      const result = timestampType.decodeWithoutValidation(dateStr, { typeCastingStrategy: 'tryCasting' })
      expect(result.isOk && result.value.toISOString()).toBe(dateStr)
    })
  })

  describe('validation', () => {
    test('validates without options', () => {
      const timestampType = model.timestamp()
      const date = new Date()
      const result = timestampType.validate(date)
      expect(result.isOk).toBe(true)
    })

    test('validates with minimum constraint - valid', () => {
      const minimum = new Date('2024-01-01T00:00:00.000Z')
      const timestampType = model.timestamp({ minimum })
      const validDate = new Date('2024-06-15T00:00:00.000Z')
      const result = timestampType.validate(validDate)
      expect(result.isOk).toBe(true)
    })

    test('validates with minimum constraint - invalid', () => {
      const minimum = new Date('2024-01-01T00:00:00.000Z')
      const timestampType = model.timestamp({ minimum })
      const invalidDate = new Date('2023-06-15T00:00:00.000Z')
      const result = timestampType.validate(invalidDate)
      expect(result.isFailure).toBe(true)
    })

    test('validates with maximum constraint - valid', () => {
      const maximum = new Date('2024-12-31T23:59:59.999Z')
      const timestampType = model.timestamp({ maximum })
      const validDate = new Date('2024-06-15T00:00:00.000Z')
      const result = timestampType.validate(validDate)
      expect(result.isOk).toBe(true)
    })

    test('validates with maximum constraint - invalid', () => {
      const maximum = new Date('2024-12-31T23:59:59.999Z')
      const timestampType = model.timestamp({ maximum })
      const invalidDate = new Date('2025-06-15T00:00:00.000Z')
      const result = timestampType.validate(invalidDate)
      expect(result.isFailure).toBe(true)
    })

    test('validates with both minimum and maximum constraints', () => {
      const minimum = new Date('2024-01-01T00:00:00.000Z')
      const maximum = new Date('2024-12-31T23:59:59.999Z')
      const timestampType = model.timestamp({ minimum, maximum })

      const validDate = new Date('2024-06-15T00:00:00.000Z')
      expect(timestampType.validate(validDate).isOk).toBe(true)

      const tooEarly = new Date('2023-06-15T00:00:00.000Z')
      expect(timestampType.validate(tooEarly).isFailure).toBe(true)

      const tooLate = new Date('2025-06-15T00:00:00.000Z')
      expect(timestampType.validate(tooLate).isFailure).toBe(true)
    })

    test('rejects invalid date (NaN)', () => {
      const minimum = new Date('2024-01-01T00:00:00.000Z')
      const timestampType = model.timestamp({ minimum })
      const invalidDate = new Date('invalid')
      const result = timestampType.validate(invalidDate)
      expect(result.isFailure).toBe(true)
    })

    test('rejects NaN date with maximum constraint', () => {
      const maximum = new Date('2024-12-31T23:59:59.999Z')
      const timestampType = model.timestamp({ maximum })
      const invalidDate = new Date('invalid')
      const result = timestampType.validate(invalidDate)
      expect(result.isFailure).toBe(true)
    })
  })

  describe('arbitrary', () => {
    test('generates valid timestamps', () => {
      const timestampType = model.timestamp()
      const arbitrary = timestampType.arbitrary(10)
      // Just verify it doesn't throw
      expect(arbitrary).toBeDefined()
    })

    test('generates timestamps within min/max bounds', () => {
      const minimum = new Date('2024-01-01T00:00:00.000Z')
      const maximum = new Date('2024-12-31T23:59:59.999Z')
      const timestampType = model.timestamp({ minimum, maximum })
      const arbitrary = timestampType.arbitrary(10)
      expect(arbitrary).toBeDefined()
    })
  })
})

describe('arbitrary based test', testWithArbitrary(model.timestamp()))

describe(
  'property based tests with tryCasting',
  testTypeDecodingAndEncoding(model.timestamp(), {
    validValues: [
      { raw: 0, decoded: new Date(0), encoded: 0 },
      { raw: 1705316000000, decoded: new Date(1705316000000), encoded: 1705316000000 },
      { raw: new Date(1705316000000) as any, decoded: new Date(1705316000000) as any, encoded: 1705316000000 },
    ],
    invalidValues: ['not a number', null, undefined as any, {}, [], true, false, 'invalid-date', 9999999999999999],
  }),
)
