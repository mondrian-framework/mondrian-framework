import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

const knownValidValues = [
  'rgba(255,255,255,0.1)',
  'rgba(0,0,0,0)',
  'rgba(127,12,33,0.3)',
  'rgba(127 , 12, 33, 0)',
  'rgba(127 , 12, 33, .8)',
]

const knownInvalidValues = [
  '',
  ' rgba(255,255,255)',
  'rgba(000,0)',
  '255,255,255,0.1',
  '(0,0,0,0)',
  'rgb(127,12,33,0.1)',
  null,
  undefined,
  10,
  10.1,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.rgba(), {
    knownValidValues,
    knownInvalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.rgba()))
