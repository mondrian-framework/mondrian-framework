import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const currency = m.currency()

test('Currency - encode', async () => {
  expect(encode(currency, 'any-string')).toBe('any-string')
})

test('Currency - decode', async () => {
  expect(decode(currency, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(currency, 10).success).toBe(false)
  expect(decode(currency, true).success).toBe(false)
  expect(decode(currency, null).success).toBe(false)
  expect(decode(currency, undefined).success).toBe(false)
})

test('Currency - valid', async () => {
  const values = ['EUR', 'GBP', 'USD']
  values.forEach((value) => expect(validate(currency, value)).toStrictEqual({ success: true, value }))
})

test('Currency - invalid', async () => {
  const values = ['', 'EUR ', 'Eur', 'eur', 'Euro', '€', 'GB P', 'Poud', '$']
  values.forEach((value) => expect(validate(currency, value).success).toBe(false))
})
