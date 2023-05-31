import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const MAC = m.MAC()

test('MAC - encode', async () => {
  expect(encode(MAC, 'any-string')).toBe('any-string')
})

test('MAC - decode', async () => {
  expect(decode(MAC, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(MAC, 10).success).toBe(false)
  expect(decode(MAC, true).success).toBe(false)
  expect(decode(MAC, null).success).toBe(false)
  expect(decode(MAC, undefined).success).toBe(false)
})

test('MAC - valid', async () => {
  const values = [
    '00-B0-D0-63-C2-26',
    '00-90-30-63-22-26',
    'AA-BB-CC-DD-EE-FF',
    '00:B0:D0:63:C2:26',
    '0090.3063.2226',
    'aa-bb-CC-dd-ee-FF',
  ]
  values.forEach((value) => expect(validate(MAC, value)).toStrictEqual({ success: true, value }))
})

test('MAC - invalid', async () => {
  const values = [
    '',
    '00-B0:D0-63:C2-26',
    '00.B0.D0.63.C2.26',
    '00-90-30-63-22',
    'AA-BB-CCDDEEFF',
    ' 00-B0-D0-63-C2-26',
    '00-90-30-63-22-26 ',
    'AA-BB-CC -DD-EE-FF',
  ]
  values.forEach((value) => expect(validate(MAC, value).success).toBe(false))
})
