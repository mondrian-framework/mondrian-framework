import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const port = m.port()

test('Port - encode', async () => {
  expect(encode(port, 8080)).toBe(8080)
})

test('Port - decode', async () => {
  expect(decode(port, 8080)).toEqual({ success: true, value: 8080 })
  expect(decode(port, 'any-string').success).toBe(false)
  expect(decode(port, true).success).toBe(false)
  expect(decode(port, null).success).toBe(false)
  expect(decode(port, undefined).success).toBe(false)
})

test('Port - valid', async () => {
  const values = [8080, 3000, 65535]
  values.forEach((value) => expect(validate(port, value)).toStrictEqual({ success: true, value }))
})

test('Port - invalid', async () => {
  const values = [0, 8080.01, -3000, 65536, 1000000]
  values.forEach((value) => expect(validate(port, value).success).toBe(false))
})
