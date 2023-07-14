import { m } from '../../src/index'
import { fc as gen } from '@fast-check/vitest'
import { testTypeEncodingAndDecoding } from '@mondrian-framework/model/src/test-helpers'
import { describe } from 'vitest'

const knownInvalidValues = [
  '',
  'any-string',
  '100',
  '-0.0.0.0',
  '127.0.0.1a',
  '19216817810',
  '192.168.178',
  '0.0..0.1',
  null,
  undefined,
  11,
  11.2,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.ip, {
    validValues: gen.oneof(gen.ipV4(), gen.ipV6()),
    knownInvalidValues,
  }),
)
