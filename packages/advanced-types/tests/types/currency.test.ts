import { m } from '../../src/index'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const currency = m.currency()
const knownValidValues: readonly string[] = currency.variants

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(currency, {
    invalidValues: gen.string().filter((value) => !knownValidValues.includes(value)),
    knownValidValues,
    knownInvalidValues: [null, undefined, 11, 11.2],
  }),
)

describe('arbitrary based test', testWithArbitrary(currency))
