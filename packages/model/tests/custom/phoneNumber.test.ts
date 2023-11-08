import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

const knownValidValues = ['+393283456888', '+393283456']
const knownInvalidValues = [
  '',
  '+3932834AABBB',
  '393283456888',
  '+39926',
  '+83791287382178937213',
  '+39 328 3456888',
  '+39-328-3456888',
  null,
  10,
  true,
  undefined,
  393283456888,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.phoneNumber(), {
    knownInvalidValues,
    knownValidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.phoneNumber()))
