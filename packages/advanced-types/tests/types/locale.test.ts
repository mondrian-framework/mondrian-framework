import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const locale = m.locale()

test('Locale - encode', async () => {
  expect(encode(locale, 'any-string')).toBe('any-string')
})

test('Locale - decode', async () => {
  expect(decode(locale, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(locale, 10).success).toBe(false)
  expect(decode(locale, true).success).toBe(false)
  expect(decode(locale, null).success).toBe(false)
  expect(decode(locale, undefined).success).toBe(false)
})

test('Locale - valid', async () => {
  const values = ['it', 'en', 'es']
  values.forEach((value) => expect(validate(locale, value)).toStrictEqual({ success: true, value }))
})

test('Locale - invalid', async () => {
  const values = ['', 'It ', 'IT', 'iT', 'it ', 'Italian', 'en-us', 'en-US']
  values.forEach((value) => expect(validate(locale, value).success).toBe(false))
})
