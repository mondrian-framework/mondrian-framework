import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const knownValidValues: readonly string[] = model.locale().variants
const knownInvalidValues = [10, true, null, undefined, '', 'It ', 'IT', 'iT', 'it ', 'Italian', 'en-us', 'en-US']
const invalidValues = gen.string().filter((value) => !knownValidValues.includes(value))

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.locale(), {
    knownValidValues,
    knownInvalidValues,
    invalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.locale()))
