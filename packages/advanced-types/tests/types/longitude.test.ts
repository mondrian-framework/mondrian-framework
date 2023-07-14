import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const min = -180
const max = 180
const constraints = { min, max }
const isLongitude = (n: number) => min <= n && n <= max && n === Number.parseFloat(n.toFixed(8))
const validValues = gen.oneof(gen.integer(constraints), gen.float(constraints)).filter(isLongitude)
const invalidValues = gen.oneof(gen.integer(), gen.float()).filter((n) => !isLongitude(n))
const knownInvalidValues = [-200, 200, 10.00000000001, null, undefined, { field: 42 }, NaN]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.longitude, {
    validValues,
    invalidValues,
    knownInvalidValues,
  }),
)
