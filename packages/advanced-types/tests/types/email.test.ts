import { test, expect } from 'vitest'
import { decode, encode, is } from '@mondrian-framework/model'
import { m } from '../../src/index'

const email = m.email()

test('Email - valid - encode', async () => {
  expect(encode(email, 'test@test.com')).toBe('test@test.com')
})

test('Email - valid - decode', async () => {
  expect(decode(email, 'test@test.com')).toStrictEqual({ pass: true, value: 'test@test.com' })
})

test('Email - valid - is', async () => {
  expect(is(email, 'test@test.com')).toBe(true)
})

test('Email - invalid - encode', async () => {
  expect(encode(email, 'test@test.com ')).toBe('test@test.com ')
  expect(encode(email, 'testtest.com')).toBe('testtest.com')
  expect(encode(email, 'whatever')).toBe('whatever')
})

test('Email - invalid - decode', async () => {
  expect(decode(email, 'testtest.com ')).toStrictEqual({ pass: false, errors: [{}] })
})

test('Email - invvalid - is', async () => {
  expect(is(email, 'test@test.com')).toBe(false)
})
