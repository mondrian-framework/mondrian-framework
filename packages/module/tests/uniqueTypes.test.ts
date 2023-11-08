import { uniqueTypes } from '../src/utils'
import { test } from '@fast-check/vitest'
import { arbitrary, model } from '@mondrian-framework/model'
import { describe, expect } from 'vitest'

function expectSameSets<A>(expected: Set<A>, actual: Set<A>) {
  expect(actual.size).toBe(expected.size)
  for (const value of expected) {
    expect(actual.has(value)).toBe(true)
  }
}

describe('uniqueTypes', () => {
  test.prop([arbitrary.baseType()])('works on base types', (type) => {
    const expected: Set<model.Type> = new Set([type])
    expectSameSets(expected, uniqueTypes(type))
  })

  test.prop([arbitrary.baseType()])('works on simple arrays', (type) => {
    const array = type.array()
    const expected: Set<model.Type> = new Set([type, array])
    expectSameSets(expected, uniqueTypes(array))
  })

  test.prop([arbitrary.baseType()])('works on simple optionals', (type) => {
    const optional = type.optional()
    const expected: Set<model.Type> = new Set([type, optional])
    expectSameSets(expected, uniqueTypes(optional))
  })

  test.prop([arbitrary.baseType()])('works on simple nullables', (type) => {
    const nullable = type.nullable()
    const expected: Set<model.Type> = new Set([type, nullable])
    expectSameSets(expected, uniqueTypes(nullable))
  })

  test('works on unions', () => {
    const Model = model.union({
      variant1: model.string(),
      variant2: model.number(),
    })
    const expected = new Set<model.Type>([Model, ...Object.values(Model.variants)])
    expectSameSets(expected, uniqueTypes(Model))
  })

  test('works on objects', () => {
    const Model = model.object({
      field1: model.string(),
      field2: model.number(),
    })
    const expected = new Set<model.Type>([Model, Model.fields.field1, Model.fields.field2])
    expectSameSets(expected, uniqueTypes(Model))
  })

  test('works on recursive objects', () => {
    const Model = () =>
      model.object({
        field1: model.optional(Model),
      })
    const got = uniqueTypes(Model)
    expect(got.size).toBe(2)
    expect(got.has(Model)).toBe(true)
    got.delete(Model)
    const field = got.values().next().value
    model.areEqual(field, model.optional(Model))
  })

  test('work on recursive unions', () => {
    const Model = () =>
      model.union({
        variant1: model.number(),
        variant2: Model,
      })
    const got = uniqueTypes(Model)
    expect(got.size).toBe(2)
    expect(got.has(Model)).toBe(true)
    got.delete(Model)
    const variants = got.values().next().value
    model.areEqual(variants, model.optional(Model))
  })

  test('works on mutually recursive objects', () => {
    const Model1 = () => model.object({ field: Model2 })
    const Model2 = () => model.object({ field: Model1 })
    const expected = new Set<model.Type>([Model1, Model2])
    expectSameSets(expected, uniqueTypes(Model1))
    expectSameSets(expected, uniqueTypes(Model2))
  })

  test('works on mutualle recursive unions', () => {
    const Model1 = () => model.union({ variant: Model2 })
    const Model2 = () => model.union({ variant: Model1 })
    const expected = new Set<model.Type>([Model1, Model2])
    expectSameSets(expected, uniqueTypes(Model1))
    expectSameSets(expected, uniqueTypes(Model2))
  })
})
