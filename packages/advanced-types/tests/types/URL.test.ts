import { test, expect } from 'vitest'
import { decode, encode } from '@mondrian-framework/model'
import { m } from '../../src/index'

const URLType = m.URL()

test('URL - encode', async () => {
  expect(encode(URLType, new URL('https://www.google.com'))).toBe('https://www.google.com/')
})

test('URL - decode', async () => {
  expect(decode(URLType, 'http://www.google.com')).toEqual({ success: true, value: new URL('http://www.google.com') })
  expect(decode(URLType, 'https://www.google.com')).toEqual({ success: true, value: new URL('https://www.google.com') })
  expect(decode(URLType, '').success).toBe(false)
  expect(decode(URLType, 'www.google.com').success).toBe(false)
  expect(decode(URLType, 'google.com').success).toBe(false)
  expect(decode(URLType, 'google').success).toBe(false)
  expect(decode(URLType, 'http://').success).toBe(false)
  expect(decode(URLType, 10).success).toBe(false)
  expect(decode(URLType, true).success).toBe(false)
  expect(decode(URLType, null).success).toBe(false)
  expect(decode(URLType, undefined).success).toBe(false)
})

test('URL - valid', async () => {})

test('URL - invalid', async () => {})
