import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from '@mondrian-framework/model/src/test-helpers'
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
  testTypeEncodingAndDecoding(m.rgb, {
    knownValidValues,
    knownInvalidValues,
  }),
)
