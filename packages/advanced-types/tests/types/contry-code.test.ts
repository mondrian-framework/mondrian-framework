import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const countryCode = m.countryCode()
const knownValidValues: readonly string[] = countryCode.variants

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(countryCode, {
    invalidValues: gen.string().filter((value) => !knownValidValues.includes(value)),
    knownValidValues,
    knownInvalidValues: [null, undefined, 11, 11.2],
  }),
)
