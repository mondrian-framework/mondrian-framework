import { m } from '../../src/index'
import { fc as gen } from '@fast-check/vitest'
import { testTypeEncodingAndDecoding } from '@mondrian-framework/model'
import { describe } from 'vitest'

const validValues = gen.webUrl()
const knownValidValues = ['http://www.google.com', 'https://www.google.com']
const knownInvalidValues = [
  'www.google.com',
  'google.com',
  'google',
  'http://',
  -200,
  2000000,
  10.1,
  null,
  undefined,
  { field: 42 },
  NaN,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.url, {
    validValues,
    knownValidValues,
    knownInvalidValues,
  }),
)
