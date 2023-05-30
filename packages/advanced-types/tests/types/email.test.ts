import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

const email = m.email()

test('Email - encode', async () => {
  expect(encode(email, 'any-string')).toBe('any-string')
})

test('Email - decode', async () => {
  expect(decode(email, 'any-string')).toEqual({ success: true, value: 'any-string' })
})

test('Email - valid', async () => {
  expect(validate(email, 'test@test.com')).toEqual({ success: true })
})

test('Email - invalid', async () => {
  expect(validate(email, 'testest.com ').success).toBe(false)
  expect(
    validate(
      email,
      'tesksajhdjkshdkjhsakjdhkjashdjksahkdhksahdjkshadjksahdjkhaskjaskjhdkjsahkdhskjhdkjsahkdhsakhdkashjksadh@test.com ',
    ).success,
  ).toBe(false)
  expect(
    validate(
      email,
      'test@sakjhdkjashdkhakjshdjashkdhasjkdhkjashdjhjksahdjksahjdhsahdsahdkshakjdhskajdhkjsahdkjhsakjdhkjsahdkjhsakjdhkjsahdkjhsakjdhksajhdksahdkjsahjkdhsakjhdkjashkdjhaskjdhakhdjksahdkjashkjdhasjkhdkashdkjsahdkjsahkjdhaksjhdkash.com ',
    ).success,
  ).toBe(false)
  expect(validate(email, 'tes@testcom ').success).toBe(false)
})
