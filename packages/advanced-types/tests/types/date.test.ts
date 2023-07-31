import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const validValues = gen
  .date()
  .filter((date) => 0 <= date.getFullYear() && date.getFullYear() <= 9999)
  .map((date) => {
    date.setUTCHours(0, 0, 0, 0)
    return {
      raw: date.toISOString().split('T')[0],
      expected: date,
    }
  })

const knownInvalidValues = [
  '2000-02-31',
  //'2020-04-32',
  //'2020-06-32',
  //'2020-09-32',
  //'2020-11-32',
  //'20230101',
  //'01012023',
  //'01-01-2023',
  //'',
  //10,
  //true,
  //null,
  //undefined,
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
  testTypeEncodingAndDecoding(m.date, {
    validValues,
    knownInvalidValues,
    knownValidValues,
  }),
)
