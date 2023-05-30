import { test, expect } from 'vitest'
import { decode, encode, validate } from '@mondrian-framework/model'
import { m } from '../../src/index'

const longitude = m.longitude()

test('Longitude - encode', async () => {
  expect(encode(longitude, 38.8951)).toBe(38.8951)
})

test('Longitude - decode', async () => {
  expect(decode(longitude, 38.8951)).toEqual({ success: true, value: 38.8951 })
  expect(decode(longitude, 'any-string').success).toBe(false)
  expect(decode(longitude, true).success).toBe(false)
  expect(decode(longitude, null).success).toBe(false)
  expect(decode(longitude, undefined).success).toBe(false)
})

test('Longitude - valid', async () => {
  const values = [-10, 10, 0, 38.8951, 140.09287998]
  values.forEach((value) => expect(validate(longitude, value)).toStrictEqual({ success: true, value }))
})

test('Longitude - invalid', async () => {
  const values = [-200, 200, 10.00000000001]
  values.forEach((value) => expect(validate(longitude, value).success).toBe(false))
})
