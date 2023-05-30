import { test, expect } from 'vitest'
import { decode, encode, validate } from '@mondrian-framework/model'
import { m } from '../../src/index'

const date = m.date()

test('Date - encode', async () => {
  expect(encode(date, new Date('2023-01-01'))).toBe('2023-01-01')
})

test('Date - decode', async () => {
  expect(decode(date, '2023-01-01')).toStrictEqual({ success: true, value: new Date('2023-01-01') })
  expect(decode(date, '20230101').success).toBe(false)
  expect(decode(date, '01012023').success).toBe(false)
  expect(decode(date, '01-01-2023').success).toBe(false)
  expect(decode(date, '').success).toBe(false)
  expect(decode(date, 10).success).toBe(false)
  expect(decode(date, true).success).toBe(false)
  expect(decode(date, null).success).toBe(false)
  expect(decode(date, undefined).success).toBe(false)
})

test('Date - valid', async () => {})

test('Date - invalid', async () => {})
