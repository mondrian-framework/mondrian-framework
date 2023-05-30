import { test, expect } from 'vitest'
import { decode, encode, validate } from '@mondrian-framework/model'
import { m } from '../../src/index'

const phoneNumber = m.phoneNumber()

test('PhoneNumber - encode', async () => {
  expect(encode(phoneNumber, 'any-string')).toBe('any-string')
})

test('PhoneNumber - decode', async () => {
  expect(decode(phoneNumber, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(phoneNumber, 10).success).toBe(false)
  expect(decode(phoneNumber, true).success).toBe(false)
  expect(decode(phoneNumber, null).success).toBe(false)
  expect(decode(phoneNumber, undefined).success).toBe(false)
})

test('PhoneNumber - valid', async () => {
  const values = ['+393283456888', '+393283456']
  values.forEach((value) => expect(validate(phoneNumber, value)).toStrictEqual({ success: true, value }))
})

test('PhoneNumber - invalid', async () => {
  const values = [
    '',
    '+3932834AABBB',
    '393283456888',
    '+39926',
    '+83791287382178937213',
    '+39 328 3456888',
    '+39-328-3456888',
  ]
  values.forEach((value) => expect(validate(phoneNumber, value).success).toBe(false))
})
