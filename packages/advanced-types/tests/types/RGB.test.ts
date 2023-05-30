import { test, expect } from 'vitest'
import { decode, encode, validate } from '@mondrian-framework/model'
import { m } from '../../src/index'

const rgb = m.RGB()

test('RGB - encode', async () => {
  expect(encode(rgb, 'any-string')).toBe('any-string')
})

test('RGB - decode', async () => {
  expect(decode(rgb, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(rgb, 10).success).toBe(false)
  expect(decode(rgb, true).success).toBe(false)
  expect(decode(rgb, null).success).toBe(false)
  expect(decode(rgb, undefined).success).toBe(false)
})

test('RGB - valid', async () => {
  const values = ['rgb(255,255,255)', 'rgb(0,0,0)', 'rgb(127,12,33)', 'rgb(127 , 12, 33)']
  values.forEach((value) => expect(validate(rgb, value)).toStrictEqual({ success: true, value }))
})

test('RGB - invalid', async () => {
  const values = ['', ' rgb(255,255,255)', 'rgb(00,0)', '255,255,255', '(0,0,0)', 'rgba(127,12,33)']
  values.forEach((value) => expect(validate(rgb, value).success).toBe(false))
})
