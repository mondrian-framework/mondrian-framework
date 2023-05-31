import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const countryCode = m.countryCode()

test('Country Code - encode', async () => {
  expect(encode(countryCode, 'any-string')).toBe('any-string')
})

test('Country Code - decode', async () => {
  expect(decode(countryCode, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(countryCode, 10).success).toBe(false)
  expect(decode(countryCode, true).success).toBe(false)
  expect(decode(countryCode, null).success).toBe(false)
  expect(decode(countryCode, undefined).success).toBe(false)
})

test('Country Code - valid', async () => {
  const values = ['IT', 'US']
  values.forEach((value) => expect(validate(countryCode, value)).toStrictEqual({ success: true, value }))
})

test('Country Code - invalid', async () => {
  const values = ['', 'IT ', 'It', 'iT', 'it', 'Italy', 'USA']
  values.forEach((value) => expect(validate(countryCode, value).success).toBe(false))
})
