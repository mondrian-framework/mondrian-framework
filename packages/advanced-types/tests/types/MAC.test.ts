import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { describe } from 'vitest'

const knownValidValues = [
  '00-B0-D0-63-C2-26',
  '00-90-30-63-22-26',
  'AA-BB-CC-DD-EE-FF',
  '00:B0:D0:63:C2:26',
  '0090.3063.2226',
  'aa-bb-CC-dd-ee-FF',
]

const knownInvalidValues = [
  '',
  '00-B0:D0-63:C2-26',
  '00.B0.D0.63.C2.26',
  '00-90-30-63-22',
  'AA-BB-CCDDEEFF',
  ' 00-B0-D0-63-C2-26',
  '00-90-30-63-22-26 ',
  'AA-BB-CC -DD-EE-FF',
  true,
  11,
  11.2,
  null,
  undefined,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.mac, {
    knownInvalidValues,
    knownValidValues,
  }),
)
