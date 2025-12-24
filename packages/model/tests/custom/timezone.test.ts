import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe, test, expect } from 'vitest'

const knownValidValues = ['Europe/Rome', 'europe/rome', 'europe/Rome', 'EUROPE/ROME', 'Africa/Cairo', 'America/Halifax']
const knownInvalidValues = ['', 'Europe ', 'Rome', 'Europe-Rome', 'Cairo', 'Africa/Halifax', null, undefined, 10, 10.1]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.timezone(), {
    knownValidValues,
    knownInvalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.timezone()))

describe('timezone additional tests', () => {
  const timezoneType = model.timezone()

  test('decodes valid timezone strings', () => {
    const result = timezoneType.decodeWithoutValidation('Europe/London')
    expect(result.isOk).toBe(true)
    if (result.isOk) {
      expect(result.value).toBe('Europe/London')
    }
  })

  test('fails to decode non-string values', () => {
    const testValues = [123, null, undefined, {}, [], true]
    for (const value of testValues) {
      const result = timezoneType.decodeWithoutValidation(value)
      expect(result.isFailure).toBe(true)
    }
  })

  test('validates IANA timezone - valid', () => {
    const validTimezones = ['America/New_York', 'Europe/Paris', 'Asia/Tokyo', 'UTC']
    for (const tz of validTimezones) {
      const result = timezoneType.validate(tz)
      expect(result.isOk).toBe(true)
    }
  })

  test('validates IANA timezone - invalid', () => {
    const result = timezoneType.validate('Invalid/Timezone')
    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      expect(result.error[0].assertion).toContain('Invalid')
    }
  })

  test('encodes timezone string', () => {
    const encoded = timezoneType.encodeWithoutValidation('Europe/Berlin')
    expect(encoded).toBe('Europe/Berlin')
  })

  test('example generation works', () => {
    const example = timezoneType.example()
    expect(typeof example).toBe('string')
  })
})
