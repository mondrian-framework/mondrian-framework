import { types } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const knownValidValues: readonly string[] = types.locale().variants
const knownInvalidValues = [10, true, null, undefined, '', 'It ', 'IT', 'iT', 'it ', 'Italian', 'en-us', 'en-US']
const invalidValues = gen.string().filter((value) => !knownValidValues.includes(value))

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(types.locale(), {
    knownValidValues,
    knownInvalidValues,
    invalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(types.locale()))
