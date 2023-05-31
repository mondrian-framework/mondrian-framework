import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const rgba = m.RGBA()

test('RGBA - encode', async () => {
  expect(encode(rgba, 'any-string')).toBe('any-string')
})

test('RGBA - decode', async () => {
  expect(decode(rgba, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(rgba, 10).success).toBe(false)
  expect(decode(rgba, true).success).toBe(false)
  expect(decode(rgba, null).success).toBe(false)
  expect(decode(rgba, undefined).success).toBe(false)
})

test('RGBA - valid', async () => {
  const values = [
    'rgba(255,255,255,0.1)',
    'rgba(0,0,0,0)',
    'rgba(127,12,33,0.3)',
    'rgba(127 , 12, 33, 0)',
    'rgba(127 , 12, 33, .8)',
  ]
  values.forEach((value) => expect(validate(rgba, value)).toStrictEqual({ success: true, value }))
})

test('RGBA - invalid', async () => {
  const values = ['', ' rgba(255,255,255)', 'rgba(000,0)', '255,255,255,0.1', '(0,0,0,0)', 'rgb(127,12,33,0.1)']
  values.forEach((value) => expect(validate(rgba, value).success).toBe(false))
})
