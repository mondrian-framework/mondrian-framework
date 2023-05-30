import { test, expect } from 'vitest'
import { decode, encode, is } from '@mondrian-framework/model'
import { m } from '../../src/index'

const email = m.email()

test('Email - encode', async () => {
  expect(encode(email, 'any-string')).toBe('any-string')
})

test('Email - decode', async () => {
  expect(decode(email, 'any-string')).toBe({ success: true, value: 'any-string' })
})

test('Email - valid', async () => {
  expect(is(email, 'test@test.com')).toStrictEqual({ success: true })
})

test('Email - invalid', async () => {
  expect(encode(email, 'testest.com ')).toStrictEqual({ success: false, errors: [{}] })
})
