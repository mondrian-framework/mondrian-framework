import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

const email = m.email()

test('Email - encode', async () => {
  expect(encode(email, 'any-string')).toBe('any-string')
})

test('Email - decode', async () => {
  expect(decode(email, 'any-string')).toStrictEqual({ success: true, value: 'any-string' })
  expect(decode(email, 10).success).toBe(false)
  expect(decode(email, true).success).toBe(false)
  expect(decode(email, null).success).toBe(false)
  expect(decode(email, undefined).success).toBe(false)
})

test('Email - valid', async () => {
  const values = ['test@test.com']
  values.forEach((value) => expect(validate(email, value)).toStrictEqual({ success: true, value }))
})

test('Email - invalid', async () => {
  const values = [
    '',
    'testest.com',
    'tesksajhdjkshdkjhsakjdhkjashdjksahkdhksahdjkshadjksahdjkhaskjaskjhdkjsahkdhskjhdkjsahkdhsakhdkashjksadh@test.com',
    'test@sakjhdkjashdkhakjshdjashkdhasjkdhkjashdjhjksahdjksahjdhsahdsahdkshakjdhskajdhkjsahdkjhsakjdhkjsahdkjhsakjdhkjsahdkjhsakjdhksajhdksahdkjsahjkdhsakjhdkjashkdjhaskjdhakhdjksahdkjashkjdhasjkhdkashdkjsahdkjsahkjdhaksjhdkash.com',
    'tes@testcom',
  ]
  values.forEach((value) => expect(validate(email, value).success).toBe(false))
})
