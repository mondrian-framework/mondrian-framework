import { projection, types } from '../src'
import { error } from '../src/result'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe, expect } from 'vitest'

// This is used for the tests on custom types to avoid repeating the long definition
const exampleCustom = types.custom(
  'customType',
  () => null,
  () => error('test', 'test'),
  () => error('test', 'test'),
)

describe('projection.InferProjection', () => {
  test('is true for base types', () => {
    expectTypeOf<projection.InferProjection<types.NumberType>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<types.StringType>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<types.BooleanType>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<types.EnumType<['one', 'two']>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<typeof exampleCustom>>().toEqualTypeOf(types.literal(true))

    expectTypeOf<projection.InferProjection<types.LiteralType<null>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<types.LiteralType<'string'>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<types.LiteralType<true>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.InferProjection<types.LiteralType<1>>>().toEqualTypeOf(types.literal(true))
  })

  test('is a correct object for ObjectType', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }
    expectTypeOf<types.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = types.object({ field1: types.object({ nested: types.number() }) })
    type Expected = true | { readonly field1: true | undefined | { readonly nested: true | undefined } }
    expectTypeOf<types.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = types.union({ variant1: types.number, variant2: types.string })
    type Expected = true | { readonly variant1: true | undefined; readonly variant2: true | undefined }
    expectTypeOf<types.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = types.union({ variant1: types.number, variant2: types.union({ subvariant1: types.number() }) })
    type Expected =
      | true
      | {
          readonly variant1: true | undefined
          readonly variant2: true | undefined | { readonly subvariant1: true | undefined }
        }
    expectTypeOf<types.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }

    const optionalObject = model.optional()
    const optionalNumber = types.number().optional()
    expectTypeOf<types.Infer<projection.InferProjection<typeof optionalObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<types.Infer<projection.InferProjection<typeof optionalNumber>>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = types.number().nullable()
    expectTypeOf<types.Infer<projection.InferProjection<typeof nullableObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<types.Infer<projection.InferProjection<typeof nullableNumber>>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = types.number().reference()
    expectTypeOf<types.Infer<projection.InferProjection<typeof objectReference>>>().toEqualTypeOf<Expected>()
    expectTypeOf<types.Infer<projection.InferProjection<typeof numberReference>>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = types.number().array()
    expectTypeOf<types.Infer<projection.InferProjection<typeof objectArray>>>().toEqualTypeOf<Expected>()
    expectTypeOf<types.Infer<projection.InferProjection<typeof numberArray>>>().toEqualTypeOf<true>()
  })

  test('can infer keys of projection object', () => {
    const model = types.object({
      field1: types.number,
      field2: types.object({ inner1: types.boolean }),
    })
    type ObjectProjection = projection.InferProjection<typeof model>
    expectTypeOf<projection.ProjectionKeys<ObjectProjection>>().toEqualTypeOf<'field1' | 'field2'>()
  })

  test('infers never as the keys of a base projection', () => {
    type LiteralProjection = projection.InferProjection<types.LiteralType<true>>
    expectTypeOf<projection.ProjectionKeys<LiteralProjection>>().toEqualTypeOf<never>()

    type NumberProjection = projection.InferProjection<typeof types.number>
    expectTypeOf<projection.ProjectionKeys<NumberProjection>>().toEqualTypeOf<never>()
  })
})

describe('projection.FromType', () => {
  test('returns the types.literal true for base types', () => {
    expect(types.areEqual(projection.fromType(types.number), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.boolean), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.string), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.enumeration(['a', 'b'])), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.literal(1)), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.literal('a')), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.literal(true)), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.literal(false)), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(types.literal(null)), types.literal(true))).toEqual(true)
    expect(types.areEqual(projection.fromType(exampleCustom), types.literal(true))).toEqual(true)
  })

  test('returns an object model for objects', () => {
    const model = types.object({
      field1: types.number,
      field2: types.object({
        inner1: types.string,
      }),
    })

    const expectedProjectionModel = types.union({
      all: types.literal(true),
      partial: types.object({
        field1: types.literal(true).optional(),
        field2: types
          .union({
            all: types.literal(true),
            partial: types.object({
              inner1: types.literal(true).optional(),
            }),
          })
          .optional(),
      }),
    })

    expect(types.areEqual(projection.fromType(model), expectedProjectionModel)).toEqual(true)
  })

  test('returns an object model for unions', () => {
    const model = types.union({
      variant1: types.number,
      variant2: types.object({
        inner1: types.string,
      }),
    })

    const expectedProjectionModel = types.union({
      all: types.literal(true),
      partial: types.object({
        variant1: types.literal(true).optional(),
        variant2: types
          .union({
            all: types.literal(true),
            partial: types.object({
              inner1: types.literal(true).optional(),
            }),
          })
          .optional(),
      }),
    })

    expect(types.areEqual(projection.fromType(model), expectedProjectionModel)).toEqual(true)
  })
})

describe('projection.ProjectionKeys', () => {
  test('returns never for types.literal projections', () => {
    expectTypeOf<projection.ProjectionKeys<types.LiteralType<true>>>().toEqualTypeOf<never>()
  })

  test('returns a union of strings for an object projection', () => {
    const model = types.object({ field1: types.number, field2: types.object({ inner1: types.boolean }) })
    type Projection = projection.InferProjection<typeof model>
    expectTypeOf<projection.ProjectionKeys<Projection>>().toEqualTypeOf<'field1' | 'field2'>()
  })
})

describe('projection.SubProjection', () => {
  test('returns never for types.literal projections', () => {
    expectTypeOf<projection.SubProjection<types.LiteralType<true>, never>>().toEqualTypeOf<never>()
  })

  test('returns subprojection for union projection', () => {
    const model = types.object({ field1: types.number, field2: types.object({ inner: types.boolean }) })
    type Projection = projection.InferProjection<typeof model>
    expectTypeOf<projection.SubProjection<Projection, 'field1'>>().toEqualTypeOf(types.literal(true).optional())

    const expectedProjection = types
      .union({
        all: types.literal(true),
        partial: types.object({ inner: types.literal(true).optional() }),
      })
      .optional()
    expectTypeOf<projection.SubProjection<Projection, 'field2'>>().toEqualTypeOf(expectedProjection)
  })
})

describe('projection.subProjection', () => {
  test('returns the sub object when provided the corresponding key', () => {
    const model = types.object({ field1: types.number, field2: types.object({ inner1: types.string }) })
    const subProjectionOnField1 = projection.subProjection(projection.fromType(model), 'field1')
    expect(types.areEqual(subProjectionOnField1, types.literal(true).optional())).toBe(true)

    const subProjectionOnField2 = projection.subProjection(projection.fromType(model), 'field2')
    const expectedSubProjection = types
      .union({
        all: types.literal(true),
        partial: types.object({ inner1: types.literal(true).optional() }),
      })
      .optional()
    expect(types.areEqual(subProjectionOnField2, expectedSubProjection)).toBe(true)
  })
})

describe('projection.depth', () => {
  test('is zero for true projections', () => {
    expect(projection.depth(projection.fromType(types.number))).toBe(0)
    expect(projection.depth(projection.fromType(types.boolean))).toBe(0)
    expect(projection.depth(projection.fromType(types.string))).toBe(0)
    expect(projection.depth(projection.fromType(types.enumeration(['a', 'b'])))).toBe(0)
    expect(projection.depth(projection.fromType(types.literal(1)))).toBe(0)
    expect(projection.depth(projection.fromType(types.literal('a')))).toBe(0)
    expect(projection.depth(projection.fromType(types.literal(true)))).toBe(0)
    expect(projection.depth(projection.fromType(types.literal(false)))).toBe(0)
    expect(projection.depth(projection.fromType(types.literal(null)))).toBe(0)
    expect(projection.depth(projection.fromType(exampleCustom))).toBe(0)
  })

  test('is the maximum depth for objects', () => {
    const model = types.object({
      field1: types.object({
        inner1: types.boolean,
        inner2: types.number,
      }),
      field2: types.string().optional(),
    })

    expect(projection.depth(projection.fromType(model))).toBe(2)
  })

  test('is the maximum depth for unions', () => {
    const model = types.union({
      variant1: types.string,
      variant2: types.object({
        inner1: types.number,
        inner2: types.union({ inner1: types.boolean }),
      }),
    })

    expect(projection.depth(projection.fromType(model))).toBe(3)
  })
})

describe('projection.ProjectedType', () => {
  test('when the type is not statically known it just returns Type', () => {
    type Projected = projection.ProjectedType<{ field: true }, types.Type>
    expectTypeOf<Projected>().toEqualTypeOf<types.Type>()
  })

  test('when the projection is true is returns the given type', () => {
    type Projected = projection.ProjectedType<true, types.NumberType>
    expectTypeOf<Projected>().toEqualTypeOf(types.number())

    const model = types.object({ field: types.boolean })
    type Projected1 = projection.ProjectedType<true, typeof model>
    expectTypeOf<Projected1>().toEqualTypeOf(model)
  })

  test('when the projection is an object it projects the keys', () => {
    const model = types.object({
      field1: types.number(),
      field2: types.boolean().optional(),
      field3: types.object({ inner1: types.string, inner2: types.boolean }),
    })

    type Projection = { field1: true; field3: { inner2: true } }
    const expected = types.object({
      field1: types.number(),
      field3: types.object({ inner2: types.boolean() }),
    })
    type Projected = projection.ProjectedType<Projection, typeof model>
    expectTypeOf<Projected>().toEqualTypeOf(expected)
  })

  test("when the projection is an object but the type isn't, returns never", () => {
    const projection = { field1: true }
    expectTypeOf<projection.ProjectedType<typeof projection, types.NumberType>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.BooleanType>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.LiteralType<true>>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.LiteralType<false>>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.LiteralType<'foo'>>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.LiteralType<1>>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.StringType>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, typeof exampleCustom>>().toEqualTypeOf<never>()
    expectTypeOf<projection.ProjectedType<typeof projection, types.EnumType<['foo', 'bar']>>>().toEqualTypeOf<never>()
  })
})
