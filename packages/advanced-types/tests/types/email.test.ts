import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe } from 'vitest'

const knownInvalidValues = [
  '',
  'testest.com',
  'tesksajhdjkshdkjhsakjdhkjashdjksahkdhksahdjkshadjksahdjkhaskjaskjhdkjsahkdhskjhdkjsahkdhsakhdkashjksadh@test.com',
  'test@sakjhdkjashdkhakjshdjashkdhasjkdhkjashdjhjksahdjksahjdhsahdsahdkshakjdhskajdhkjsahdkjhsakjdhkjsahdkjhsakjdhkjsahdkjhsakjdhksajhdksahdkjsahjkdhsakjhdkjashkdjhaskjdhakhdjksahdkjashkjdhasjkhdkashdkjsahdkjsahkjdhaksjhdkash.com',
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
  testTypeEncodingAndDecoding(m.email, {
    validValues: gen.emailAddress(),
    knownInvalidValues,
  }),
)
