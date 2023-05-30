import { test, expect } from 'vitest'
import { decode, encode, validate } from '@mondrian-framework/model'
import { m } from '../../src/index'

const UUID = m.UUID()

test('UUID - encode', async () => {
  expect(encode(UUID, 'any-string')).toBe('any-string')
})

test('UUID - decode', async () => {
  expect(decode(UUID, 'any-string')).toEqual({ success: true, value: 'any-string' })
  expect(decode(UUID, 10).success).toBe(false)
  expect(decode(UUID, true).success).toBe(false)
  expect(decode(UUID, null).success).toBe(false)
  expect(decode(UUID, undefined).success).toBe(false)
})

test('UUID - valid', async () => {
  const values = ['5aa824cd-5444-4f8f-b878-4191ad702b64', '162cbc04-847a-47fc-8a33-f1dc61360034']
  values.forEach((value) => expect(validate(UUID, value)).toStrictEqual({ success: true, value }))
})

test('UUID - invalid', async () => {
  const values = [
    '',
    'asdsadas ',
    'e6d49c0061ac4cfeaa7a2c2dcc55afd1',
    'e6d4c00-61ac-4cfe-aa7a-2c2dcc55afd',
    'e6d49c00-61ac-4cfe-aa7a-',
    'e6d49c00-61ac.4cfe.aa7a.2c2dcc55afd1',
  ]
  values.forEach((value) => expect(validate(UUID, value).success).toBe(false))
})
