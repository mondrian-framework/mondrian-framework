import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const min = 1
const max = 65535
const constraints = { min, max }
const isPort = (n: number) => min <= n && n <= max && Number.isInteger(n)

const validValues = gen.integer(constraints)
const invalidValues = gen.oneof(gen.integer(), gen.float()).filter((n) => !isPort(n))
const knownInvalidValues = [-200, 2000000, 10.1, null, undefined, { field: 42 }, NaN]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.port, {
    validValues,
    invalidValues,
    knownInvalidValues,
  }),
)
