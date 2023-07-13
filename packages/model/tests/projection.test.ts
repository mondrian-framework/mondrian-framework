import { Projection, ProjectionKeys, isProjection, subProjection } from '../src/projection'
import {
  BooleanType,
  EnumType,
  LiteralType,
  NumberType,
  StringType,
  boolean,
  number,
  object,
  string,
  union,
} from '../src/type-system'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe, expect } from 'vitest'

describe('Projection inference', () => {
  test('is true for base types', () => {
    expectTypeOf<Projection<NumberType>>().toEqualTypeOf<true>()
    expectTypeOf<Projection<StringType>>().toEqualTypeOf<true>()
    expectTypeOf<Projection<BooleanType>>().toEqualTypeOf<true>()
    expectTypeOf<Projection<EnumType<['one', 'two']>>>().toEqualTypeOf<true>()

    expectTypeOf<Projection<LiteralType<null>>>().toEqualTypeOf<true>()
    expectTypeOf<Projection<LiteralType<'string'>>>().toEqualTypeOf<true>()
    expectTypeOf<Projection<LiteralType<true>>>().toEqualTypeOf<true>()
    expectTypeOf<Projection<LiteralType<1>>>().toEqualTypeOf<true>()
  })

  test('is a correct object for ObjectType', () => {
    const model = object({ field1: number, field2: number })
    type Expected = true | { readonly field1?: true; readonly field2?: true }
    expectTypeOf<Projection<typeof model>>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = object({ field1: object({ nested: number() }) })
    type Expected = true | { readonly field1?: true | { readonly nested?: true } }
    expectTypeOf<Projection<typeof model>>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = union({ variant1: number, variant2: string })
    type Expected = true | { readonly variant1?: true; readonly variant2?: true }
    expectTypeOf<Projection<typeof model>>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = union({ variant1: number, variant2: union({ subvariant1: number() }) })
    type Expected = true | { readonly variant1?: true; readonly variant2?: true | { readonly subvariant1?: true } }
    expectTypeOf<Projection<typeof model>>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = object({ field1: number, field2: number })
    type Expected = true | { readonly field1?: true; readonly field2?: true }

    const optionalObject = model.optional()
    const optionalNumber = number().optional()
    expectTypeOf<Projection<typeof optionalObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<Projection<typeof optionalNumber>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = number().nullable()
    expectTypeOf<Projection<typeof nullableObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<Projection<typeof nullableNumber>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = number().reference()
    expectTypeOf<Projection<typeof objectReference>>().toEqualTypeOf<Expected>()
    expectTypeOf<Projection<typeof numberReference>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = number().array()
    expectTypeOf<Projection<typeof objectArray>>().toEqualTypeOf<Expected>()
    expectTypeOf<Projection<typeof numberArray>>().toEqualTypeOf<true>()
  })
})

describe('isProjection', () => {
  test('works on projection for object', () => {
    const model = object({
      field: string(),
      nested: object({
        subField: number(),
      }),
    })

    expect(isProjection(true, model)).toBe(true)
    expect(isProjection({ field: true }, model)).toBe(true)
    expect(isProjection({ field: true, nested: true }, model)).toBe(true)
    expect(isProjection({ field: true, nested: { subField: true } }, model)).toBe(true)

    expect(isProjection({ field: false }, model)).toBe(false)
    expect(isProjection({ notAField: false }, model)).toBe(false)
    expect(isProjection({ nested: { subField: false } }, model)).toBe(false)
  })

  test('is always true with true', () => {
    console.log('TODO: once we have generators for Type we can test this')
  })
})

describe('subProjection', () => {
  test('works on objects', () => {
    const model = object({
      field: boolean(),
    })
    const b = subProjection<typeof model, 'field'>(true, 'field')
  })
})
