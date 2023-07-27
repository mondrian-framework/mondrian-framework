import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { describe } from 'vitest'

const knownValidValues = [
  { raw: 'http://www.google.com', expected: new URL('http://www.google.com') },
  { raw: 'https://www.google.com', expected: new URL('https://www.google.com') },
]

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
    knownValidValues,
    knownInvalidValues,
  }),
)
