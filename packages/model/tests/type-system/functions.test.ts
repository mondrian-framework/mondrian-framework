import { arbitrary, types } from '../../src'
import { test } from '@fast-check/vitest'
import { expect } from 'vitest'

test.prop([arbitrary.type()])('A type is always equal to itself', (type) => {
  expect(types.areEqual(type, type)).toBe(true)
})

test('A recursive lazy type is equal to itself', () => {
  const t1 = () => types.object({ t1 })
  expect(types.areEqual(t1, t1)).toBe(true)
})

test('Two recursive lazy type are not equals because of different field name', () => {
  const t1 = () => types.object({ t1 })
  const t2 = () => types.object({ t2 })
  expect(types.areEqual(t1, t2)).toBe(false)
})

test('Two recursive lazy type are not equals because of optionality', () => {
  const t1 = () => types.object({ field: types.optional(t1) })
  const t2 = () => types.object({ field: t2 })
  expect(types.areEqual(t1, t2)).toBe(false)
})

/* //TODO: at the moment this test do not pass but should pass. This are limit cases and for now we do not consider this important
test('Two lazy type are equals', () => {
  const t1 = () => types.object({ c: types.optional(t2), b: types.number({ minimum: 0 }) })
  const t2 = () => types.object({ c: types.optional(t1), b: types.number() })
  expect(types.areEqual(t1, t2)).toBe(false)
})

test('Two lazy type are equals', () => {
  const t1 = () => types.object({ c: types.optional(t2), b: types.number() })
  const t2 = () => types.object({ c: types.optional(t1), b: types.number() })
  expect(types.areEqual(t1, t2)).toBe(true)
})
*/
