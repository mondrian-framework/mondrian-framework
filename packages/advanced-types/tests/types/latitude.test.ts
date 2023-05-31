import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const latitude = m.latitude()

test('Latitude - encode', async () => {
  expect(encode(latitude, 38.8951)).toBe(38.8951)
})

test('Latitude - decode', async () => {
  expect(decode(latitude, 38.8951)).toEqual({ success: true, value: 38.8951 })
  expect(decode(latitude, 'any-string').success).toBe(false)
  expect(decode(latitude, true).success).toBe(false)
  expect(decode(latitude, null).success).toBe(false)
  expect(decode(latitude, undefined).success).toBe(false)
})

test('Latitude - valid', async () => {
  const values = [-10, 10, 0, 38.8951, 77.09287998]
  values.forEach((value) => expect(validate(latitude, value)).toStrictEqual({ success: true, value }))
})

test('Latitude - invalid', async () => {
  const values = [-200, 200, 10.00000000001]
  values.forEach((value) => expect(validate(latitude, value).success).toBe(false))
})
