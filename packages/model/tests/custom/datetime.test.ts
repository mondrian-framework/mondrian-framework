import { model } from '../../src'
import { describe, expect, test } from 'vitest'

describe('datetime type', () => {
  test('throws when minimum is after maximum', () => {
    expect(() =>
      model.datetime({
        minimum: new Date('2024-12-31T00:00:00Z'),
        maximum: new Date('2024-01-01T00:00:00Z'),
      }),
    ).toThrow('Minimum date cannot be after maximum date.')
  })

  test('decodes Date instances directly', () => {
    const date = new Date('2024-06-15T12:00:00.000Z')
    const result = model.datetime().decodeWithoutValidation(date)
    expect(result.isOk && result.value.getTime()).toBe(date.getTime())
  })

  test('decodes ISO string in expectExactTypes mode', () => {
    const result = model.datetime().decodeWithoutValidation('2024-06-15T12:00:00.000Z')
    expect(result.isOk && result.value.toISOString()).toBe('2024-06-15T12:00:00.000Z')
  })

  test('fails to decode invalid ISO string in expectExactTypes mode', () => {
    const result = model.datetime().decodeWithoutValidation('not-a-date')
    expect(result.isFailure).toBe(true)
  })

  test('fails to decode non-string non-Date in expectExactTypes mode', () => {
    const result = model.datetime().decodeWithoutValidation({})
    expect(result.isFailure).toBe(true)
  })

  test('decodes numeric timestamp with tryCasting', () => {
    const ts = Date.UTC(2024, 5, 15)
    const result = model.datetime().decodeWithoutValidation(ts, { typeCastingStrategy: 'tryCasting' })
    expect(result.isOk && result.value.getTime()).toBe(ts)
  })

  test('decodes numeric string with tryCasting', () => {
    const ts = Date.UTC(2024, 5, 15)
    const result = model.datetime().decodeWithoutValidation(String(ts), { typeCastingStrategy: 'tryCasting' })
    expect(result.isOk && result.value.getTime()).toBe(ts)
  })

  // Hits `tryMakeDate` failure path when the string is neither a number nor a parseable date
  // (datetime.ts:74 true branch).
  test('fails tryMakeDate when string is neither number nor parseable date', () => {
    const result = model.datetime().decodeWithoutValidation('definitely-not-a-date', {
      typeCastingStrategy: 'tryCasting',
    })
    expect(result.isFailure).toBe(true)
  })

  test('encodes date as ISO string', () => {
    const date = new Date('2024-06-15T12:00:00.000Z')
    const encoded = model.datetime().encodeWithoutValidation(date)
    expect(encoded).toBe('2024-06-15T12:00:00.000Z')
  })

  test('validates within minimum/maximum range', () => {
    const dt = model.datetime({
      minimum: new Date('2024-01-01T00:00:00.000Z'),
      maximum: new Date('2024-12-31T23:59:59.999Z'),
    })
    expect(dt.validate(new Date('2024-06-15T00:00:00.000Z')).isOk).toBe(true)
    expect(dt.validate(new Date('2023-06-15T00:00:00.000Z')).isFailure).toBe(true)
    expect(dt.validate(new Date('2025-06-15T00:00:00.000Z')).isFailure).toBe(true)
  })
})
