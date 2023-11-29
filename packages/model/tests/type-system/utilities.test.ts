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
  test.prop([arbitrary.modelAndValue()])('with random types', ([Model, value]) => {
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
  /*
  test('respect lazyness', () => {
    const p1 = model.partialDeep(model.string())
    expect(p1.kind === model.Kind.String)

    const p2 = model.partialDeep(() => model.string())
    expect(p2().kind === model.Kind.String)

    const m = () => () => model.string()
    const p3 = model.partialDeep(m)
    expect(p3()().kind === model.Kind.String)

    const p4 = model.partialDeep(m)
    expect(p4()().kind === model.Kind.String)
    expect(p3 === p4).toBe(true)

    const p5 = model.partialDeep(() => () => () => model.string())
    expect(p5()()().kind === model.Kind.String)
  })*/
})

describe('pick', () => {
  test('works on object', () => {
    const m = () =>
      model.object({
        a: model.string(),
        b: model.number().nullable(),
      })
    const m1 = model.pick(m, { b: true }, { name: 'Picked' })
    expect(model.areEqual(model.object({ b: model.number().nullable() }, { name: 'Picked' }), m1)).toBe(true)
  })
  test('works on entity', () => {
    const m = () =>
      model.entity({
        a: model.string(),
        b: model.number().nullable(),
      })
    const m1 = model.pick(m, { a: true }, { name: 'Picked' })
    expect(model.areEqual(model.entity({ a: model.string() }, { name: 'Picked' }), m1)).toBe(true)
  })
  test('empty', () => {
    const m = () =>
      model.object({
        a: model.string(),
        b: model.number().nullable(),
      })
    const m1 = model.pick(m, {})
    expect(model.areEqual(model.object({}), m1)).toBe(true)
  })
  test('unexpected type', () => {
    expect(() => model.pick(model.string() as any, {})).toThrowError(
      '[internal error] `pick` is available only for object and entity types',
    )
  })
  /*
  test('respect lazyness', () => {
    const p1 = model.pick(model.object({}), {})
    expect(p1.kind === model.Kind.Object)

    const p2 = () => model.pick(model.object({}), {})
    expect(p2().kind === model.Kind.Object)

    const m = () => () => model.object({})
    const p3 = model.pick(m, {})
    expect(p3()().kind === model.Kind.Object)

    const p4 = model.pick(m, {})
    expect(p4()().kind === model.Kind.Object)
    expect(p3 === p4).toBe(true)

    const p5 = model.pick(() => () => () => model.object({}), {})
    expect(p5()()().kind === model.Kind.Object)
  })*/
})

test('variant ownership', () => {
  const union = model.union({
    a: model.integer(),
    b: model.number({ minimum: 0 }),
    c: model.string(),
  })

  expect(union.variantOwnership(-5)).toBe('a')
  expect(union.variantOwnership('Hello')).toBe('c')
  expect(union.variantOwnership(1.1)).toBe('b')
  expect(union.variantOwnership(-1.1)).toBe('a')
})

test('isType', () => {
  const union = model.union({
    a: model.integer(),
    b: model.number({ minimum: 0 }),
    c: model.string(),
  })

  expect(model.isType(union, 2)).toBe(true)
  expect(model.isType(union, -1.1)).toBe(false)
  expect(model.isType(union, 'asd')).toBe(true)
  expect(model.isType(union, 2.2)).toBe(true)
})

test('isType', () => {
  const union = model.union({
    a: model.integer(),
    b: model.number({ minimum: 0 }),
    c: model.string(),
  })

  expect(model.assertType(union, 2)).toBe(undefined)
  expect(() => model.assertType(union, -1.1)).toThrowError()
  expect(model.assertType(union, 'asd')).toBe(undefined)
  expect(model.assertType(union, 2.2)).toBe(undefined)
})

test('getFirstDescription', () => {
  const m = model.string({ description: 'a' }).nullable({ description: 'b' }).optional()
  expect(model.getFirstDescription(m.array())).toBe(undefined)
  expect(model.getFirstDescription(m)).toBe('b')
})

test('isNever', () => {
  expect(model.isNever(model.never().array())).toBe(false)
  expect(model.isNever(model.never().optional())).toBe(true)
  expect(model.isNever(model.never().nullable())).toBe(true)
  expect(model.isNever(model.number().optional())).toBe(false)
})

test('isObject', () => {
  expect(model.isObject(model.object({}).array())).toBe(false)
  expect(model.isObject(model.object({}).optional())).toBe(true)
  expect(model.isObject(model.object({}).nullable())).toBe(true)
  expect(model.isObject(model.number().optional())).toBe(false)
})

test('isEntity', () => {
  expect(model.isEntity(model.entity({}).array())).toBe(false)
  expect(model.isEntity(model.entity({}).optional())).toBe(true)
  expect(model.isEntity(model.entity({}).nullable())).toBe(true)
  expect(model.isEntity(model.number().optional())).toBe(false)
})

test('failing match', () => {
  expect(() => model.match(model.string() as any, { number: () => 1 })).toThrowError(
    '[internal error] `model.match` with not exhaustive cases occurs',
  )
})
