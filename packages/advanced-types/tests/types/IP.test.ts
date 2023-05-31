import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const IP = m.IP()

test('IP - encode', async () => {
  expect(encode(IP, 'any-string')).toBe('any-string')
})

test('IP - decode', async () => {
  expect(decode(IP, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(IP, 10).success).toBe(false)
  expect(decode(IP, true).success).toBe(false)
  expect(decode(IP, null).success).toBe(false)
  expect(decode(IP, undefined).success).toBe(false)
})

test('IP - valid', async () => {
  const values = ['0.0.0.0', '192.168.178.19', '127.0.0.1']
  values.forEach((value) => expect(validate(IP, value)).toStrictEqual({ success: true, value }))
})

test('IP - invalid', async () => {
  const values = ['', 'any-string', '100', '-0.0.0.0', '127.0.0.1a', '19216817810', '192.168.178', '0.0..0.1']
  values.forEach((value) => expect(validate(IP, value).success).toBe(false))
})
