import { arbitrary, model } from '../../src'
import { test } from '@fast-check/vitest'
import { expect } from 'vitest'

test.prop([arbitrary.type()])('A type is always equal to itself', (type) => {
  expect(model.areEqual(type, type)).toBe(true)
})

test('A recursive lazy type is equal to itself', () => {
  const t1 = () => model.object({ t1 })
  expect(model.areEqual(t1, t1)).toBe(true)
})

test('Two recursive lazy type are not equals because of different field name', () => {
  const t1 = () => model.object({ t1 })
  const t2 = () => model.object({ t2 })
  expect(model.areEqual(t1, t2)).toBe(false)
})

test('Two recursive lazy type are not equals because of optionality', () => {
  const t1 = () => model.object({ field: model.optional(t1) })
  const t2 = () => model.object({ field: t2 })
  expect(model.areEqual(t1, t2)).toBe(false)
})

test('Two lazy type are not equals', () => {
  const t1 = () => model.object({ c: model.optional(t2), b: model.number({ minimum: 0 }) })
  const t2 = () => model.object({ c: model.optional(t1), b: model.number() })
  expect(model.areEqual(t1, t2)).toBe(false)
})

test('Two lazy type are equals', () => {
  const t1 = () => model.object({ c: model.optional(t2), b: model.number() }).setName('T')
  const t2 = () => model.object({ c: model.optional(t1), b: model.number() }).setName('T')
  expect(model.areEqual(t1, t2)).toBe(true)
})

test('Two lazy type are not equals because of lazy names', () => {
  const t1 = () => model.object({ c: model.optional(t2), b: model.number() })
  const t2 = () => model.object({ c: model.optional(t1), b: model.number() })
  expect(model.areEqual(t1, t2)).toBe(false)
})
