import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

// 263-character domain (above the 255 cap enforced by email.ts:35) where every individual
// label is <= 63 characters, so the `> 255` check is reached before the per-label check.
const longDomain =
  'a'.repeat(60) + '.' + 'b'.repeat(60) + '.' + 'c'.repeat(60) + '.' + 'd'.repeat(60) + '.' + 'e'.repeat(15) + '.com'

const knownInvalidValues = [
  '',
  'testest.com',
  'tesksajhdjkshdkjhsakjdhkjashdjksahkdhksahdjkshadjksahdjkhaskjaskjhdkjsahkdhskjhdkjsahkdhsakhdkashjksadh@test.com',
  'test@sakjhdkjashdkhakjshdjashkdhasjkdhkjashdjhjksahdjksahjdhsahdsahdkshakjdhskajdhkjsahdkjhsakjdhkjsahdkjhsakjdhkjsahdkjhsakjdhksajhdksahdkjsahjkdhsakjhdkjashkdjhaskjdhakhdjksahdkjashkjdhasjkhdkashdkjsahdkjsahkjdhaksjhdkash.com',
  `tes@${longDomain}`,
  'tes@testcom',
  { email: 'foo@bar.com' },
  null,
  true,
  undefined,
  10,
  10.2,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(model.email(), {
    validValues: gen.emailAddress(),
    knownInvalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(model.email()))
