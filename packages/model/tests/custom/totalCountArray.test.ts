import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

const knownInvalidValues = ['hello', ['asd'], [1, 2, 3, 4], [-1, 2], new model.TotalCountArray(5, [-1, 2, 3])]
const knownValidValues = [[1, 2], new model.TotalCountArray(5, [1, 2, 3])]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.array(model.number({ minimum: 0 }), { maxItems: 3, totalCount: true }), {
    knownInvalidValues,
    knownValidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.array(model.number(), { maxItems: 3, totalCount: true })))
