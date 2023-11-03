import { uniqueTypes } from '../src/utils'
import { test } from '@fast-check/vitest'
import { arbitrary, types } from '@mondrian-framework/model'
import { describe, expect } from 'vitest'

function expectSameSets<A>(expected: Set<A>, actual: Set<A>) {
  expect(actual.size).toBe(expected.size)
  for (const value of expected) {
    expect(actual.has(value)).toBe(true)
  }
}

describe('uniqueTypes', () => {
  test.prop([arbitrary.baseType()])('works on base types', (type) => {
    const expected: Set<types.Type> = new Set([type])
    expectSameSets(expected, uniqueTypes(type))
  })

  test.prop([arbitrary.baseType()])('works on simple arrays', (type) => {
    const array = type.array()
    const expected: Set<types.Type> = new Set([type, array])
    expectSameSets(expected, uniqueTypes(array))
  })

  test.prop([arbitrary.baseType()])('works on simple optionals', (type) => {
    const optional = type.optional()
    const expected: Set<types.Type> = new Set([type, optional])
    expectSameSets(expected, uniqueTypes(optional))
  })

  test.prop([arbitrary.baseType()])('works on simple nullables', (type) => {
    const nullable = type.nullable()
    const expected: Set<types.Type> = new Set([type, nullable])
    expectSameSets(expected, uniqueTypes(nullable))
  })

  test('works on unions', () => {
    const model = types.union({
      variant1: types.string(),
      variant2: types.number(),
    })
    const expected = new Set<types.Type>([model, ...Object.values(model.variants)])
    expectSameSets(expected, uniqueTypes(model))
  })

  test('works on objects', () => {
    const model = types.object({
      field1: types.string(),
      field2: types.number(),
    })
    const expected = new Set<types.Type>([model, model.fields.field1, model.fields.field2])
    expectSameSets(expected, uniqueTypes(model))
  })

  test('works on recursive objects', () => {
    const model = () =>
      types.object({
        field1: types.optional(model),
      })
    const got = uniqueTypes(model)
    expect(got.size).toBe(2)
    expect(got.has(model)).toBe(true)
    got.delete(model)
    const field = got.values().next().value
    types.areEqual(field, types.optional(model))
  })

  test('work on recursive unions', () => {
    const model = () =>
      types.union({
        variant1: types.number(),
        variant2: model,
      })
    const got = uniqueTypes(model)
    expect(got.size).toBe(2)
    expect(got.has(model)).toBe(true)
    got.delete(model)
    const variants = got.values().next().value
    types.areEqual(variants, types.optional(model))
  })

  test('works on mutually recursive objects', () => {
    const model1 = () => types.object({ field: model2 })
    const model2 = () => types.object({ field: model1 })
    const expected = new Set<types.Type>([model1, model2])
    expectSameSets(expected, uniqueTypes(model1))
    expectSameSets(expected, uniqueTypes(model2))
  })

  test('works on mutualle recursive unions', () => {
    const model1 = () => types.union({ variant: model2 })
    const model2 = () => types.union({ variant: model1 })
    const expected = new Set<types.Type>([model1, model2])
    expectSameSets(expected, uniqueTypes(model1))
    expectSameSets(expected, uniqueTypes(model2))
  })
})
