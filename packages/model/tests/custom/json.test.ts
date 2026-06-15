import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe, expect, test } from 'vitest'

const knownValidValues = [
  { raw: undefined, expected: null },
  { raw: new Date(1), expected: new Date(1).toISOString() },
  { raw: [1], expected: [1] },
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.json(), { knownValidValues }, { skipInverseCheck: true }),
)

describe('arbitrary based test', testWithArbitrary(model.json(), false))

test('oversized json', () => {
  const result = model.json({ sizeLimit: 5 }).decode({ a: 'aaaaaaaaaa' })
  expect(result.isOk).toBe(false)
  expect(result.isFailure && result.error).toStrictEqual([
    { assertion: 'json must be maximum of 5B', got: 18, path: '$' },
  ])
})

test('json within size limit succeeds validation', () => {
  const result = model.json({ sizeLimit: 100 }).decode({ a: 'short' })
  expect(result.isOk).toBe(true)
  expect(result.isOk && result.value).toEqual({ a: 'short' })
})

test('json with non-finite numbers fails validation', () => {
  // JSON cannot represent NaN/±Infinity: JSON.stringify turns them into null, so encoding such
  // values would silently corrupt them (and break the encode∘decode roundtrip).
  for (const nonFinite of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
    const topLevel = model.json().validate(nonFinite)
    expect(topLevel.isFailure && topLevel.error).toStrictEqual([
      { assertion: 'json cannot contain non-finite numbers', got: nonFinite, path: '$' },
    ])
    const nested = model.json().validate({ a: [{ b: nonFinite }] })
    expect(nested.isFailure).toBe(true)
    const encoded = model.json().encode({ a: nonFinite })
    expect(encoded.isFailure).toBe(true)
  }
})

test('json with finite numbers succeeds validation', () => {
  const result = model.json().validate({ a: [Number.MAX_VALUE, -Number.MAX_VALUE, 0, -0, 1.5] })
  expect(result.isOk).toBe(true)
})

test('json decoding normalizes values through a JSON round-trip', () => {
  const result = model.json().decode({ a: -0, b: undefined })
  expect(result.isOk).toBe(true)
  // -0 is serialized as "0" by JSON.stringify and undefined fields are dropped
  expect(result.isOk && Object.is((result.value as { a: number }).a, 0)).toBe(true)
  expect(result.isOk && result.value).toStrictEqual({ a: 0 })
})
