import { test, expect } from 'vitest'
import { decode, encode, validate } from '@mondrian-framework/model'
import { m } from '../../src/index'

const ISBN = m.ISBN()

test('ISBN - encode', async () => {
  expect(encode(ISBN, 'any-string')).toBe('any-string')
})

test('ISBN - decode', async () => {
  expect(decode(ISBN, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(ISBN, 10).success).toBe(false)
  expect(decode(ISBN, true).success).toBe(false)
  expect(decode(ISBN, null).success).toBe(false)
  expect(decode(ISBN, undefined).success).toBe(false)
})

test('ISBN - valid', async () => {
  const values = [
    '978-3-16-148410-0',
    '0-545-01022-5',
    'ISBN-10 0-545-01022-5',
    'ISBN-10: 0-545-01022-5',
    'ISBN 978-3-16-148410-0',
    'ISBN-13 978-3-16-148410-0',
    'ISBN-13: 978-3-16-148410-0',
  ]
  values.forEach((value) => expect(validate(ISBN, value)).toStrictEqual({ success: true, value }))
})

test('ISBN - invalid', async () => {
  const values = [
    '',
    'AAA-3-16-148410-0',
    '978-3-16-148410',
    '213123131223212',
    'ISBSN-10 0-545-01022-5',
    'LKJLJ',
    '054501022-5',
    'ISBN--978-3-16-148410-0',
  ]
  values.forEach((value) => expect(validate(ISBN, value).success).toBe(false))
})
