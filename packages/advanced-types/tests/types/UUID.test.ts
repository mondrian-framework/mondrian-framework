import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const validValues = gen.uuid()
const knownValidValues = ['5aa824cd-5444-4f8f-b878-4191ad702b64', '162cbc04-847a-47fc-8a33-f1dc61360034']
const knownInvalidValues = [
  '',
  'asdsadas ',
  'e6d49c0061ac4cfeaa7a2c2dcc55afd1',
  'e6d4c00-61ac-4cfe-aa7a-2c2dcc55afd',
  'e6d49c00-61ac-4cfe-aa7a-',
  'e6d49c00-61ac.4cfe.aa7a.2c2dcc55afd1',
  -200,
  2000000,
  10.1,
  null,
  undefined,
  { field: 42 },
  NaN,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.uuid, {
    validValues,
    knownValidValues,
    knownInvalidValues,
  }),
)
