import { arbitrary, types } from '../../src'
import { object } from '../../src/types-exports'
import { assertOk } from '../testing-utils'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

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
    expect(types.isOptional(types.string().optional().array())).toBe(false)
    expect(types.isOptional(types.string().optional().array().optional())).toBe(true)
  })
  test('isNullable', () => {
    expect(types.isNullable(types.string().array().nullable())).toBe(true)
    expect(types.isNullable(types.string().nullable())).toBe(true)
    expect(types.isNullable(types.string().nullable().optional())).toBe(true)
    expect(types.isNullable(types.string().nullable().array())).toBe(false)
    expect(types.isNullable(types.string().nullable().array().nullable())).toBe(true)
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

describe('partialDeep', () => {
  test.prop([arbitrary.typeAndValue()])('with random types', ([model, value]) => {
    const partialModel = types.concretise(types.partialDeep(model))
    assertOk(partialModel.validate(value))
  })

  test('validate with scalar', () => {
    const model = types.string().nullable().optional()
    const partialModel = types.partialDeep(model)
    assertOk(partialModel.validate(''))
    assertOk(partialModel.validate(null))
    assertOk(partialModel.validate(undefined))
  })
  test('validate with array', () => {
    const model = types.string().nullable().array().nullable()
    const partialModel = types.partialDeep(model)
    assertOk(partialModel.validate([null, '']))
    assertOk(partialModel.validate(null))
  })
  test('validate with recursive object', () => {
    const model = () => object({ field1: types.string(), model })
    const partialModel = types.partialDeep(model)
    assertOk(partialModel().validate({}))
    assertOk(partialModel().validate({ field1: '' }))
    assertOk(partialModel().validate({ model: {} }))
    assertOk(partialModel().validate({ model: { field1: '' } }))
  })
  test('validate with recursive union', () => {
    const model = () => types.union({ field1: types.string(), field2: types.object({ inner: model }) })
    const partialModel = types.partialDeep(model)
    assertOk(partialModel().validate(''))
    assertOk(partialModel().validate({ inner: '' }))
    assertOk(partialModel().validate({ inner: { inner: undefined } }))
    assertOk(partialModel().validate({ inner: { inner: '' } }))
  })
})
