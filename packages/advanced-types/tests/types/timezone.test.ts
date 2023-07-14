import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const timezone = m.timezone()

test('Timezone - encode', async () => {
  expect(encode(timezone, 'any-string')).toBe('any-string')
})

test('Timezone - decode', async () => {
  expect(decode(timezone, 'any-string').success).toBe(false)
  expect(decode(timezone, 10).success).toBe(false)
  expect(decode(timezone, true).success).toBe(false)
  expect(decode(timezone, null).success).toBe(false)
  expect(decode(timezone, undefined).success).toBe(false)
})

test('Timezone - valid', async () => {
  const values = ['Europe/Rome', 'europe/rome', 'europe/Rome', 'EUROPE/ROME', 'Africa/Cairo', 'America/Halifax']
  values.forEach((value) => expect(validate(timezone, value)).toStrictEqual({ success: true, value }))
})

test('Timezone - invalid', async () => {
  const values = ['', 'Europe ', 'Rome', 'Europe-Rome', 'Cairo', 'Africa/Halifax']
  values.forEach((value) => expect(validate(timezone, value).success).toBe(false))
})
