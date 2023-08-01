import { projection } from '../src'
import { error } from '../src/result'
import {
  BooleanType,
  EnumType,
  Infer,
  LiteralType,
  NumberType,
  OptionalType,
  StringType,
  areSameType,
  boolean,
  custom,
  enumeration,
  literal,
  number,
  object,
  string,
  union,
} from '../src/type-system'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe, expect } from 'vitest'

// This is used for the tests on custom types to avoid repeating the long definition
const exampleCustom = custom(
  'customType',
  () => null,
  () => error('test', 'test'),
  () => error('test', 'test'),
)

describe('Projection inference', () => {
  test('is true for base types', () => {
    expectTypeOf<projection.InferProjection<NumberType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<StringType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<BooleanType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<EnumType<['one', 'two']>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<typeof exampleCustom>>().toEqualTypeOf<LiteralType<true>>()

    expectTypeOf<projection.InferProjection<LiteralType<null>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<LiteralType<'string'>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<LiteralType<true>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<projection.InferProjection<LiteralType<1>>>().toEqualTypeOf<LiteralType<true>>()
  })

  test('is a correct object for ObjectType', () => {
    const model = object({ field1: number, field2: number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }
    expectTypeOf<Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = object({ field1: object({ nested: number() }) })
    type Expected = true | { readonly field1: true | undefined | { readonly nested: true | undefined } }
    expectTypeOf<Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = union({ variant1: number, variant2: string })
    type Expected = true | { readonly variant1: true | undefined; readonly variant2: true | undefined }
    expectTypeOf<Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = union({ variant1: number, variant2: union({ subvariant1: number() }) })
    type Expected =
      | true
      | {
          readonly variant1: true | undefined
          readonly variant2: true | undefined | { readonly subvariant1: true | undefined }
        }
    expectTypeOf<Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = object({ field1: number, field2: number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }

    const optionalObject = model.optional()
    const optionalNumber = number().optional()
    expectTypeOf<Infer<projection.InferProjection<typeof optionalObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<projection.InferProjection<typeof optionalNumber>>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = number().nullable()
    expectTypeOf<Infer<projection.InferProjection<typeof nullableObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<projection.InferProjection<typeof nullableNumber>>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = number().reference()
    expectTypeOf<Infer<projection.InferProjection<typeof objectReference>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<projection.InferProjection<typeof numberReference>>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = number().array()
    expectTypeOf<Infer<projection.InferProjection<typeof objectArray>>>().toEqualTypeOf<Expected>()
    expectTypeOf<Infer<projection.InferProjection<typeof numberArray>>>().toEqualTypeOf<true>()
  })

  test('can infer keys of projection object', () => {
    const model = object({
      field1: number,
      field2: object({ inner1: boolean }),
    })
    type ObjectProjection = projection.InferProjection<typeof model>
    expectTypeOf<projection.ProjectionKeys<ObjectProjection>>().toEqualTypeOf<'field1' | 'field2'>()
  })

  test('infers never as the keys of a base projection', () => {
    type LiteralProjection = projection.InferProjection<LiteralType<true>>
    expectTypeOf<projection.ProjectionKeys<LiteralProjection>>().toEqualTypeOf<never>()

    type NumberProjection = projection.InferProjection<typeof number>
    expectTypeOf<projection.ProjectionKeys<NumberProjection>>().toEqualTypeOf<never>()
  })
})

describe('projectionFromType', () => {
  test('returns the literal true for base types', () => {
    expect(areSameType(projection.fromType(number), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(boolean), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(string), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(enumeration(['a', 'b'])), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(literal(1)), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(literal('a')), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(literal(true)), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(literal(false)), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(literal(null)), literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(exampleCustom), literal(true))).toEqual(true)
  })

  test('returns an object model for objects', () => {
    const model = object({
      field1: number,
      field2: object({
        inner1: string,
      }),
    })

    const expectedProjectionModel = union({
      all: literal(true),
      partial: object({
        field1: literal(true).optional(),
        field2: union({
          all: literal(true),
          partial: object({
            inner1: literal(true).optional(),
          }),
        }).optional(),
      }),
    })

    expect(areSameType(projection.fromType(model), expectedProjectionModel)).toEqual(true)
  })

  test('returns an object model for unions', () => {
    const model = union({
      variant1: number,
      variant2: object({
        inner1: string,
      }),
    })

    const expectedProjectionModel = union({
      all: literal(true),
      partial: object({
        variant1: literal(true).optional(),
        variant2: union({
          all: literal(true),
          partial: object({
            inner1: literal(true).optional(),
          }),
        }).optional(),
      }),
    })

    expect(areSameType(projection.fromType(model), expectedProjectionModel)).toEqual(true)
  })
})

describe('projection.ProjectionKeys', () => {
  test('returns never for literal projections', () => {
    expectTypeOf<projection.ProjectionKeys<LiteralType<true>>>().toEqualTypeOf<never>()
  })

  test('returns a union of strings for an object projection', () => {
    const model = object({ field1: number, field2: object({ inner1: boolean }) })
    type Projection = projection.InferProjection<typeof model>
    expectTypeOf<projection.ProjectionKeys<Projection>>().toEqualTypeOf<'field1' | 'field2'>()
  })
})

describe('projection.SubProjection', () => {
  test('returns never for literal projections', () => {
    expectTypeOf<projection.SubProjection<LiteralType<true>, never>>().toEqualTypeOf<never>()
  })

  test('returns subprojection for union projection', () => {
    const model = object({ field1: number, field2: object({ inner: boolean }) })
    type Projection = projection.InferProjection<typeof model>
    expectTypeOf<projection.SubProjection<Projection, 'field1'>>().toEqualTypeOf<OptionalType<LiteralType<true>>>()

    const expectedProjection = union({
      all: literal(true),
      partial: object({ inner: literal(true).optional() }),
    }).optional()
    expectTypeOf<projection.SubProjection<Projection, 'field2'>>().toEqualTypeOf(expectedProjection)
  })
})

describe('subProjection', () => {
  test('returns the sub object when provided the corresponding key', () => {
    const model = object({ field1: number, field2: object({ inner1: string }) })
    const p = projection.fromType(model)

    const subProjectionOnField1 = projection.subProjection(p, 'field1')
    expect(areSameType(subProjectionOnField1, literal(true).optional())).toBe(true)

    const subProjectionOnField2 = projection.subProjection(p, 'field2')
    const expectedSubProjection = union({
      all: literal(true),
      partial: object({ inner1: literal(true).optional() }),
    }).optional()
    expect(areSameType(subProjectionOnField2, expectedSubProjection)).toBe(true)
  })
})

describe('projection.depth', () => {
  test('is zero for true projections', () => {
    expect(projection.depth(projection.fromType(number))).toBe(0)
    expect(projection.depth(projection.fromType(boolean))).toBe(0)
    expect(projection.depth(projection.fromType(string))).toBe(0)
    expect(projection.depth(projection.fromType(enumeration(['a', 'b'])))).toBe(0)
    expect(projection.depth(projection.fromType(literal(1)))).toBe(0)
    expect(projection.depth(projection.fromType(literal('a')))).toBe(0)
    expect(projection.depth(projection.fromType(literal(true)))).toBe(0)
    expect(projection.depth(projection.fromType(literal(false)))).toBe(0)
    expect(projection.depth(projection.fromType(literal(null)))).toBe(0)
    expect(projection.depth(projection.fromType(exampleCustom))).toBe(0)
  })

  test('is the maximum depth for objects', () => {
    const model = object({
      field1: object({
        inner1: boolean,
        inner2: number,
      }),
      field2: string().optional(),
    })

    expect(projection.depth(projection.fromType(model))).toBe(2)
  })

  test('is the maximum depth for unions', () => {
    const model = union({
      variant1: string,
      variant2: object({
        inner1: number,
        inner2: union({ inner1: boolean }),
      }),
    })

    expect(projection.depth(projection.fromType(model))).toBe(3)
  })
})
