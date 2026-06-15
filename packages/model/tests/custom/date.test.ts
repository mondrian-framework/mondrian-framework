import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

const knownInvalidValues = [
  '1999-02-29',
  '2000-02-30',
  '2020-04-32',
  '2020-06-32',
  '2020-09-32',
  '2020-11-32',
  '20230101',
  '01012023',
  '01-01-2023',
  '',
  10,
  true,
  null,
  undefined,
  // year with too many digits passes the regex but Date.parse returns NaN -> hits the
  // `Number.isNaN(date.valueOf())` branch in `decoder` (date.ts:34)
  '+999999999999999-01-01',
  '-999999999999999-12-31',
]
const knownValidValues = [
  { raw: '2020-01-01', expected: new Date('2020-01-01') },
  { raw: '2020-04-01', expected: new Date('2020-04-01') },
  { raw: '2020-06-01', expected: new Date('2020-06-01') },
  { raw: '2020-09-01', expected: new Date('2020-09-01') },
  { raw: '2020-11-01', expected: new Date('2020-11-01') },
  { raw: '2020-02-01', expected: new Date('2020-02-01') },
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.date(), {
    knownInvalidValues,
    knownValidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.date()))
