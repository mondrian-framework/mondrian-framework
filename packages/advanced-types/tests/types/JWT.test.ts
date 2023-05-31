import { m } from '../../src/index'
import { decode, encode, validate } from '@mondrian-framework/model'
import { test, expect } from 'vitest'

const JWT = m.JWT()

test('JWT - encode', async () => {
  expect(encode(JWT, 'any-string')).toBe('any-string')
})

test('JWT - decode', async () => {
  expect(decode(JWT, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(JWT, 10).success).toBe(false)
  expect(decode(JWT, true).success).toBe(false)
  expect(decode(JWT, null).success).toBe(false)
  expect(decode(JWT, undefined).success).toBe(false)
})

test('JWT - valid', async () => {
  const values = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  ]
  values.forEach((value) => expect(validate(JWT, value)).toStrictEqual({ success: true, value }))
})

test('JWT - invalid', async () => {
  const values = [
    '',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQSflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'InR5cCI6IkpXVCJ9kpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwp',
    '{ "sub": "1234567890","name": "John Doe","iat": 1516239022 }',
  ]
  values.forEach((value) => expect(validate(JWT, value).success).toBe(false))
})
