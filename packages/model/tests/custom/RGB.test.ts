import { types } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

const knownValidValues = ['rgb(255,255,255)', 'rgb(0,0,0)', 'rgb(127,12,33)', 'rgb(127 , 12, 33)']
const knownInvalidValues = [
  '',
  ' rgb(255,255,255)',
  'rgb(00,0)',
  '255,255,255',
  '(0,0,0)',
  'rgba(127,12,33)',
  null,
  undefined,
  10,
  10.1,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(types.rgb(), {
    knownValidValues,
    knownInvalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(types.rgb()))
