import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const validValues = gen.webUrl().map((urlString) => ({ raw: urlString, expected: urlString }))
const knownValidValues = [
  { raw: 'http://www.google.com/', expected: 'http://www.google.com/' },
  { raw: 'https://www.google.com', expected: 'https://www.google.com' },
]

const knownInvalidValues = [
  'smtp://www.google.com/',
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
  testTypeEncodingAndDecoding(
    model.url({ allowedProtocols: ['http', 'https'] }),
    {
      validValues,
      knownValidValues,
      knownInvalidValues,
    },
    {
      skipInverseCheck: true,
    },
  ),
)

describe('arbitrary based test', testWithArbitrary(model.url()))
