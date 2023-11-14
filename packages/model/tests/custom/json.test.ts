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
  expect(!result.isOk && result.error).toStrictEqual([{ assertion: 'json must be maximum of 5B', got: 18, path: '$' }])
})
