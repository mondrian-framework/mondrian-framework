import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

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
