import { ProjectionKeys, InferProjection, projectionDepth, subProjection } from '../src/projection'
import {
  BooleanType,
  EnumType,
  Infer,
  LiteralType,
  NumberType,
  ObjectType,
  StringType,
  array,
  boolean,
  enumeration,
  literal,
  number,
  object,
  string,
  union,
} from '../src/type-system'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe, expect } from 'vitest'

describe('Projection inference', () => {
  test('is true for base types', () => {
    expectTypeOf<InferProjection<NumberType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<StringType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<BooleanType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<EnumType<['one', 'two']>>>().toEqualTypeOf<LiteralType<true>>()

    expectTypeOf<InferProjection<LiteralType<null>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<LiteralType<'string'>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<LiteralType<true>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<LiteralType<1>>>().toEqualTypeOf<LiteralType<true>>()
  })

  test('is a correct object for ObjectType', () => {
    const model = object({ field1: number, field2: number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }
    expectTypeOf<Infer<InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = object({ field1: object({ nested: number() }) })
    type Expected = true | { readonly field1: true | undefined | { readonly nested: true | undefined } }
    expectTypeOf<Infer<InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = union({ variant1: number, variant2: string })
    type Expected = true | { readonly variant1: true | undefined; readonly variant2: true | undefined }
    expectTypeOf<Infer<InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = union({ variant1: number, variant2: union({ subvariant1: number() }) })
    type Expected =
      | true
      | {
          readonly variant1: true | undefined
          readonly variant2: true | undefined | { readonly subvariant1: true | undefined }
        }
    expectTypeOf<Infer<InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = object({ field1: number, field2: number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }

    const optionalObject = model.optional()
    const optionalNumber = number().optional()
    expectTypeOf<Infer<InferProjection<typeof optionalObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<InferProjection<typeof optionalNumber>>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = number().nullable()
    expectTypeOf<Infer<InferProjection<typeof nullableObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<InferProjection<typeof nullableNumber>>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = number().reference()
    expectTypeOf<Infer<InferProjection<typeof objectReference>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<InferProjection<typeof numberReference>>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = number().array()
    expectTypeOf<Infer<InferProjection<typeof objectArray>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<InferProjection<typeof numberArray>>>().toEqualTypeOf<true>()
  })

  test('can infer keys of projection object', () => {
    const model = object({
      field1: number,
      field2: object({ inner1: boolean }),
    })
    type ObjectProjection = InferProjection<typeof model>
    expectTypeOf<ProjectionKeys<ObjectProjection>>().toEqualTypeOf<'field1' | 'field2'>()
  })

  test('infers never as the keys of a base projection', () => {
    type LiteralProjection = InferProjection<LiteralType<true>>
    expectTypeOf<ProjectionKeys<LiteralProjection>>().toEqualTypeOf<never>()

    type NumberProjection = InferProjection<typeof number>
    expectTypeOf<ProjectionKeys<NumberProjection>>().toEqualTypeOf<never>()
  })
})

describe('subProjection', () => {
  test('is always true on primitive types', () => {
    expect(subProjection(number, true, true)).toBe(true)
    expect(subProjection(string, true, true)).toBe(true)
    expect(subProjection(boolean, true, true)).toBe(true)
    expect(subProjection(enumeration(['one', 'two']), true, true)).toBe(true)
    expect(subProjection(literal(1), true, true)).toBe(true)
    expect(subProjection(literal('mondrian'), true, true)).toBe(true)
    expect(subProjection(literal(null), true, true)).toBe(true)
    expect(subProjection(literal(true), true, true)).toBe(true)
    expect(subProjection(literal(false), true, true)).toBe(true)
  })

  test('works on objects', () => {
    const model = object({
      field1: object({
        inner1: number,
        inner2: number,
      }),
      field2: number,
    })

    expect(subProjection(model, true, true)).toEqual(true)
    expect(subProjection(model, true, 'field1')).toEqual(true)
    expect(subProjection(model, true, 'field2')).toEqual(true)

    expect(subProjection(model, { field2: true }, true)).toEqual(true)
    expect(subProjection(model, { field2: true }, 'field1')).toEqual(undefined)
    expect(subProjection(model, { field2: true }, 'field2')).toEqual(true)

    expect(subProjection(model, { field1: { inner1: true } }, true)).toEqual(true)
    expect(subProjection(model, { field1: { inner1: true } }, 'field1')).toEqual({ inner1: true })
    expect(subProjection(model, { field1: { inner1: true } }, 'field2')).toEqual(undefined)
  })
})

describe('projectionDepth', () => {
  test('is zero for true projections', () => {
    expect(projectionDepth<typeof number>(true)).toBe(0)
    expect(projectionDepth<typeof string>(true)).toBe(0)
    expect(projectionDepth<typeof boolean>(true)).toBe(0)
    expect(projectionDepth<EnumType<['one', 'two']>>(true)).toBe(0)
    expect(projectionDepth<LiteralType<1>>(true)).toBe(0)
    expect(projectionDepth<LiteralType<'mondrian'>>(true)).toBe(0)
    expect(projectionDepth<LiteralType<null>>(true)).toBe(0)
    expect(projectionDepth<LiteralType<true>>(true)).toBe(0)
    expect(projectionDepth<LiteralType<false>>(true)).toBe(0)
  })

  test('is the maximum depth for objects', () => {
    const model = object({
      field1: object({
        inner1: boolean,
        inner2: number,
      }),
      field2: string().optional(),
    })

    expect(projectionDepth<typeof model>(true)).toBe(0)
    expect(projectionDepth<typeof model>({ field1: true })).toBe(1)
    expect(projectionDepth<typeof model>({ field1: {} })).toBe(1)
    expect(projectionDepth<typeof model>({ field1: { inner1: true } })).toBe(2)
    expect(projectionDepth<typeof model>({ field1: { inner1: true, inner2: true } })).toBe(2)
    expect(projectionDepth<typeof model>({ field1: { inner1: true, inner2: true }, field2: true })).toBe(2)
  })
})
