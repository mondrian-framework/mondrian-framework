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


describe('Utilities', () => {
  test('isArray', () => {
    expect(types.isArray(types.string().array())).toBe(true)
    expect(types.isArray(types.string().array().optional())).toBe(true)
    expect(types.isArray(types.string().array().nullable())).toBe(true)
    expect(types.isArray(types.string().array())).toBe(true)
    expect(types.isArray(types.string().optional().array().array())).toBe(true)
    expect(types.isArray(types.string().optional())).toBe(false)
  })
  test('isOptional', () => {
    expect(types.isOptional(types.string().array().optional())).toBe(true)
    expect(types.isOptional(types.string().optional())).toBe(true)
    expect(types.isOptional(types.string().optional().nullable())).toBe(true)
    expect(types.isOptional(types.string().optional().reference())).toBe(true)
    expect(types.isOptional(types.string().optional().array())).toBe(false)
    expect(types.isOptional(types.string().optional().array().optional)).toBe(true)
  })
  test('isReference', () => {
    expect(types.isReference(types.string().array().reference())).toBe(true)
    expect(types.isReference(types.string().reference())).toBe(true)
    expect(types.isReference(types.string().reference().nullable())).toBe(true)
    expect(types.isReference(types.string().reference().optional())).toBe(true)
    expect(types.isReference(types.string().reference().array())).toBe(false)
    expect(types.isReference(types.string().reference().array().reference)).toBe(true)
  })
  test('isNullable', () => {
    expect(types.isNullable(types.string().array().nullable())).toBe(true)
    expect(types.isNullable(types.string().nullable())).toBe(true)
    expect(types.isNullable(types.string().nullable().reference())).toBe(true)
    expect(types.isNullable(types.string().nullable().optional())).toBe(true)
    expect(types.isNullable(types.string().nullable().array())).toBe(false)
    expect(types.isNullable(types.string().nullable().array().nullable)).toBe(true)
  })

  test('isNullable', () => {
    expect(types.unwrap(types.string().array().nullable()).kind).toBe(types.Kind.String)
    expect(types.unwrap(types.string().nullable()).kind).toBe(types.Kind.String)
  })

  test('isScalar', () => {
    expect(types.isScalar(types.string().array().nullable())).toBe(false)
    expect(types.isScalar(types.object({}))).toBe(false)
    expect(types.isScalar(types.union({}))).toBe(false)
    expect(types.isScalar(types.string().nullable())).toBe(true)
  })
})
