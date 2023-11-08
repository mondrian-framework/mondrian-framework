import { arbitrary, model } from '../../src'
import { object } from '../../src/types-exports'
import { assertOk } from '../testing-utils'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

describe('Utilities', () => {
  test('isArray', () => {
    expect(model.isArray(model.string().array())).toBe(true)
    expect(model.isArray(model.string().array().optional())).toBe(true)
    expect(model.isArray(model.string().array().nullable())).toBe(true)
    expect(model.isArray(model.string().array())).toBe(true)
    expect(model.isArray(model.string().optional().array().array())).toBe(true)
    expect(model.isArray(model.string().optional())).toBe(false)
  })
  test('isOptional', () => {
    expect(model.isOptional(model.string().array().optional())).toBe(true)
    expect(model.isOptional(model.string().optional())).toBe(true)
    expect(model.isOptional(model.string().optional().nullable())).toBe(true)
    expect(model.isOptional(model.string().optional().array())).toBe(false)
    expect(model.isOptional(model.string().optional().array().optional())).toBe(true)
  })
  test('isNullable', () => {
    expect(model.isNullable(model.string().array().nullable())).toBe(true)
    expect(model.isNullable(model.string().nullable())).toBe(true)
    expect(model.isNullable(model.string().nullable().optional())).toBe(true)
    expect(model.isNullable(model.string().nullable().array())).toBe(false)
    expect(model.isNullable(model.string().nullable().array().nullable())).toBe(true)
  })

  test('isNullable', () => {
    expect(model.unwrap(model.string().array().nullable()).kind).toBe(model.Kind.String)
    expect(model.unwrap(model.string().nullable()).kind).toBe(model.Kind.String)
  })

  test('isScalar', () => {
    expect(model.isScalar(model.string().array().nullable())).toBe(false)
    expect(model.isScalar(model.object({}))).toBe(false)
    expect(model.isScalar(model.union({}))).toBe(false)
    expect(model.isScalar(model.string().nullable())).toBe(true)
  })
})

describe('partialDeep', () => {
  test.prop([arbitrary.typeAndValue()])('with random types', ([Model, value]) => {
    const PartialModel = model.concretise(model.partialDeep(Model))
    assertOk(PartialModel.validate(value))
  })

  test('validate with scalar', () => {
    const Model = model.string().nullable().optional()
    const PartialModel = model.partialDeep(Model)
    assertOk(PartialModel.validate(''))
    assertOk(PartialModel.validate(null))
    assertOk(PartialModel.validate(undefined))
  })
  test('validate with array', () => {
    const Model = model.string().nullable().array().nullable()
    const PartialModel = model.partialDeep(Model)
    assertOk(PartialModel.validate([null, '']))
    assertOk(PartialModel.validate(null))
  })
  test('validate with recursive object', () => {
    const Model = () => object({ field1: model.string(), model: Model })
    const PartialModel = model.partialDeep(Model)
    assertOk(PartialModel().validate({}))
    assertOk(PartialModel().validate({ field1: '' }))
    assertOk(PartialModel().validate({ model: {} }))
    assertOk(PartialModel().validate({ model: { field1: '' } }))
  })
  test('validate with recursive union', () => {
    const Model = () => model.union({ field1: model.string(), field2: model.object({ inner: Model }) })
    const PartialModel = model.partialDeep(Model)
    assertOk(PartialModel().validate(''))
    assertOk(PartialModel().validate({ inner: '' }))
    assertOk(PartialModel().validate({ inner: { inner: undefined } }))
    assertOk(PartialModel().validate({ inner: { inner: '' } }))
  })
})
