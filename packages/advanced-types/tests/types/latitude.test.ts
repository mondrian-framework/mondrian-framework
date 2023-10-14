import { m } from '../../src/index'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const min = -90
const max = 90
const constraints = { min, max }
const isLatitude = (n: number) => min <= n && n <= max && n === Number.parseFloat(n.toFixed(8))
const validValues = gen.oneof(gen.integer(constraints), gen.float(constraints)).filter(isLatitude)
const invalidValues = gen.oneof(gen.integer(), gen.float()).filter((n) => !isLatitude(n))
const knownInvalidValues = [-200, 200, 10.00000000001, null, undefined, { field: 42 }, NaN]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.latitude(), {
    validValues,
    invalidValues,
    knownInvalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(m.latitude()))
