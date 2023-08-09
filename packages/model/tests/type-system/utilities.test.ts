import { types, validator } from '../../src'
import { describe, expect, test } from 'vitest'

describe('merge', () => {
  test('Lazyness is supported', () => {
    const t3 = () => types.merge(t1, t2)
    const t4 = types.merge(t3, types.object({}))
    const t1 = () => types.object({ n: types.number(), t2: types.optional(t2) })
    const t2 = () => () => types.object({ s: types.string(), t1: types.optional(t1) })
    const result = validator.validate(t4, { n: 1, s: '1', t2: { s: '2' } })
    expect(result.isOk).toBe(true)
  })
})

describe('pick', () => {
  test('Lazyness is supported', () => {
    const t3 = () => types.pick(t1, { t2: true })
    const t4 = types.merge(t3, types.object({}))
    const t1 = () => types.object({ n: types.number(), t2: types.optional(t2) })
    const t2 = () => () => types.object({ s: types.string(), t1: types.optional(t1) })
    const result = validator.validate(t4, { t2: { s: '2' } })
    expect(result.isOk).toBe(true)
  })
})

describe('omit', () => {
  test('Lazyness is supported', () => {
    const t3 = () => types.omit(t1, { n: true })
    const t4 = types.merge(t3, types.object({}))
    const t1 = () => types.object({ n: types.number(), t2: types.optional(t2) })
    const t2 = () => () => types.object({ s: types.string(), t1: types.optional(t1) })
    const result = validator.validate(t4, { t2: { s: '2' } })
    expect(result.isOk).toBe(true)
  })
})

describe('omitReferences', () => {
  test('Lazyness is supported', () => {
    const t3 = () => types.omitReferences(t1)
    const t4 = types.merge(t3, types.object({}))
    const t1 = () => types.object({ n: types.number().reference(), t2: types.optional(t2) })
    const t2 = () => () => types.object({ s: types.string(), t1: types.optional(t1) })
    const result = validator.validate(t4, { t2: { s: '2' } })
    expect(result.isOk).toBe(true)
  })
})

describe('partial', () => {
  test('Lazyness is supported', () => {
    const t3 = () => types.partial(t1)
    const t4 = types.merge(t3, types.object({}))
    const t1 = () => types.object({ n: types.number(), t2: types.optional(t2) })
    const t2 = () => () => types.object({ s: types.string(), t1: types.optional(t1) })
    const result = validator.validate(t4, { t2: { s: '2' } })
    expect(result.isOk).toBe(true)
  })
})
