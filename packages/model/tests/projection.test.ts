import { projection, types, decoder, validator } from '../src'
import { expectSameTypes } from './testing-utils'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe, expect } from 'vitest'

// This is used for the tests on custom types to avoid repeating the long definition
const exampleCustom = types.custom(
  'customType',
  () => null,
  () => decoder.fail('test', 'test'),
  () => validator.fail('test', 'test'),
)

describe('projection.FromType', () => {
  test('is true for base types', () => {
    expectTypeOf<projection.FromType<types.NumberType>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<types.StringType>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<types.BooleanType>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<types.EnumType<['one', 'two']>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<typeof exampleCustom>>().toEqualTypeOf(types.literal(true))

    expectTypeOf<projection.FromType<types.LiteralType<null>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<types.LiteralType<'string'>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<types.LiteralType<true>>>().toEqualTypeOf(types.literal(true))
    expectTypeOf<projection.FromType<types.LiteralType<1>>>().toEqualTypeOf(types.literal(true))
  })

  test('is a correct object for ObjectType', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Inferred = projection.FromType<typeof model>
    const expected = types.union({
      all: types.literal(true),
      partial: types.object({
        field1: types.literal(true).optional(),
        field2: types.literal(true).optional(),
      }),
    })
    expectTypeOf<Inferred>().toEqualTypeOf(expected)
  })

  test('works on nested objects', () => {
    const model = types.object({ field1: types.object({ nested: types.number() }) })
    type Inferred = projection.FromType<typeof model>
    const expected = types.union({
      all: types.literal(true),
      partial: types.object({
        field1: types
          .union({
            all: types.literal(true),
            partial: types.object({
              nested: types.literal(true).optional(),
            }),
          })
          .optional(),
      }),
    })
    expectTypeOf<Inferred>().toEqualTypeOf(expected)
  })

  test('is a correct object for UnionType', () => {
    const model = types.union({ variant1: types.number, variant2: types.string })
    type Inferred = projection.FromType<typeof model>
    const expected = types.union({
      all: types.literal(true),
      partial: types.object({
        variant1: types.literal(true).optional(),
        variant2: types.literal(true).optional(),
      }),
    })
    expectTypeOf<Inferred>().toEqualTypeOf(expected)
  })

  test('works on nested unions', () => {
    const model = types.union({ variant1: types.number, variant2: types.union({ subvariant1: types.number() }) })
    type Inferred = projection.FromType<typeof model>
    const expected = types.union({
      all: types.literal(true),
      partial: types.object({
        variant1: types.literal(true).optional(),
        variant2: types
          .union({
            all: types.literal(true),
            partial: types.object({
              subvariant1: types.literal(true).optional(),
            }),
          })
          .optional(),
      }),
    })
    expectTypeOf<Inferred>().toEqualTypeOf(expected)
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    const expected = types.union({
      all: types.literal(true),
      partial: types.object({
        field1: types.literal(true).optional(),
        field2: types.literal(true).optional(),
      }),
    })

    const optionalObject = model.optional()
    const optionalNumber = types.number().optional()
    expectTypeOf<projection.FromType<typeof optionalObject>>().toEqualTypeOf(expected)
    expectTypeOf<projection.FromType<typeof optionalNumber>>().toEqualTypeOf(types.literal(true))

    const nullableObject = model.nullable()
    const nullableNumber = types.number().nullable()
    expectTypeOf<projection.FromType<typeof nullableObject>>().toEqualTypeOf(expected)
    expectTypeOf<projection.FromType<typeof nullableNumber>>().toEqualTypeOf(types.literal(true))

    const objectReference = model.reference()
    const numberReference = types.number().reference()
    expectTypeOf<projection.FromType<typeof objectReference>>().toEqualTypeOf(expected)
    expectTypeOf<projection.FromType<typeof numberReference>>().toEqualTypeOf(types.literal(true))

    const objectArray = model.array()
    const numberArray = types.number().array()
    expectTypeOf<projection.FromType<typeof objectArray>>().toEqualTypeOf(expected)
    expectTypeOf<projection.FromType<typeof numberArray>>().toEqualTypeOf(types.literal(true))
  })

  test('can infer keys of projection object', () => {
    const model = types.object({
      field1: types.number,
      field2: types.object({ inner1: types.boolean }),
    })
    type ObjectProjection = projection.FromType<typeof model>
    expectTypeOf<projection.ProjectionKeys<ObjectProjection>>().toEqualTypeOf<'field1' | 'field2'>()
  })

  test('infers never as the keys of a base projection', () => {
    type LiteralProjection = projection.FromType<types.LiteralType<true>>
    expectTypeOf<projection.ProjectionKeys<LiteralProjection>>().toEqualTypeOf<never>()

    type NumberProjection = projection.FromType<typeof types.number>
    expectTypeOf<projection.ProjectionKeys<NumberProjection>>().toEqualTypeOf<never>()
  })
})

describe('projection.fromType', () => {
  test('returns the types.literal true for base types', () => {
    expectSameTypes(projection.fromType(types.number), types.literal(true))
    expectSameTypes(projection.fromType(types.boolean), types.literal(true))
    expectSameTypes(projection.fromType(types.string), types.literal(true))
    expectSameTypes(projection.fromType(types.enumeration(['a', 'b'])), types.literal(true))
    expectSameTypes(projection.fromType(types.literal(1)), types.literal(true))
    expectSameTypes(projection.fromType(types.literal('a')), types.literal(true))
    expectSameTypes(projection.fromType(types.literal(true)), types.literal(true))
    expectSameTypes(projection.fromType(types.literal(false)), types.literal(true))
    expectSameTypes(projection.fromType(types.literal(null)), types.literal(true))
    expectSameTypes(projection.fromType(exampleCustom), types.literal(true))
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

    expectSameTypes(projection.fromType(model), expectedProjectionModel)
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

    expectSameTypes(projection.fromType(model), expectedProjectionModel)
  })

  test("returns the projection of an array's wrapped type", () => {
    const model = types.object({ field1: types.number }).array()
    const arrayProjection = projection.fromType(model)
    const wrappedTypeProjection = projection.fromType(model.wrappedType)
    expectSameTypes(arrayProjection, wrappedTypeProjection)
  })

  test("returns the projection of an optional's wrapped type", () => {
    const model = types.object({ field1: types.number }).optional()
    const arrayProjection = projection.fromType(model)
    const wrappedTypeProjection = projection.fromType(model.wrappedType)
    expectSameTypes(arrayProjection, wrappedTypeProjection)
  })

  test("returns the projection of a nullable's wrapped type", () => {
    const model = types.object({ field1: types.number }).nullable()
    const arrayProjection = projection.fromType(model)
    const wrappedTypeProjection = projection.fromType(model.wrappedType)
    expectSameTypes(arrayProjection, wrappedTypeProjection)
  })

  test("returns the projection of a reference's wrapped type", () => {
    const model = types.object({ field1: types.number }).reference()
    const arrayProjection = projection.fromType(model)
    const wrappedTypeProjection = projection.fromType(model.wrappedType)
    expectSameTypes(arrayProjection, wrappedTypeProjection)
  })
})

describe('projection.ProjectionKeys', () => {
  test('returns never for types.literal projections', () => {
    expectTypeOf<projection.ProjectionKeys<types.LiteralType<true>>>().toEqualTypeOf<never>()
  })

  test('returns a union of strings for an object projection', () => {
    const model = types.object({ field1: types.number, field2: types.object({ inner1: types.boolean }) })
    type Projection = projection.FromType<typeof model>
    expectTypeOf<projection.ProjectionKeys<Projection>>().toEqualTypeOf<'field1' | 'field2'>()
  })
})

describe('projection.SubProjection', () => {
  test('returns never for types.literal projections', () => {
    expectTypeOf<projection.SubProjection<types.LiteralType<true>, never>>().toEqualTypeOf<never>()
  })

  test('returns subprojection for union projection', () => {
    const model = types.object({ field1: types.number, field2: types.object({ inner: types.boolean }) })
    type Projection = projection.FromType<typeof model>
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
    expectSameTypes(subProjectionOnField1, types.literal(true).optional())

    const subProjectionOnField2 = projection.subProjection(projection.fromType(model), 'field2')
    const expectedSubProjection = types
      .union({
        all: types.literal(true),
        partial: types.object({ inner1: types.literal(true).optional() }),
      })
      .optional()
    expectSameTypes(subProjectionOnField2, expectedSubProjection)
  })

  test('cannot be called on true projections', () => {
    expect(() => projection.subProjection(types.literal(true), {} as never)).toThrowError(/.*\[internal error\].*/)
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
  test('when the projection is true is returns the given type', () => {
    type Projected = projection.ProjectedType<types.NumberType, true>
    expectTypeOf<Projected>().toEqualTypeOf(types.number())

    const model = types.object({ field: types.boolean })
    type Projected1 = projection.ProjectedType<typeof model, true>
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
    type Projected = projection.ProjectedType<typeof model, Projection>
    expectTypeOf<Projected>().toEqualTypeOf(expected)
  })

  test('an empty projection returns an empty object type', () => {
    const model = types.object({ field1: types.number(), field2: types.number() })
    type Projected = projection.ProjectedType<typeof model, {}>
    expectTypeOf<Projected>().toEqualTypeOf(types.object({}))
  })

  test('a projection on a union is the projection of its variants', () => {
    const model = types.union({ variant1: types.number(), variant2: types.object({ field: types.string() }) })
    type P1 = { variant1: true }
    type UnionProjection1 = projection.ProjectedType<typeof model, P1>
    const projected1 = types.union({ variant1: types.number() })
    expectTypeOf<UnionProjection1>().toEqualTypeOf(projected1)

    type P2 = { variant1: true; variant2: { field: true } }
    type UnionProjection2 = projection.ProjectedType<typeof model, P2>
    expectTypeOf<UnionProjection2>().toEqualTypeOf(model)
  })

  test('when the object is a wrapper the projected type is itself wrapped', () => {
    const model = types.object({ field1: types.string(), field2: types.number() })
    const projected = types.object({ field1: types.string() })
    type P = { field1: true }

    const optional = model.optional()
    type OptionalProjection = projection.ProjectedType<typeof optional, P>
    expectTypeOf<OptionalProjection>().toEqualTypeOf(projected.optional())

    const nullable = model.nullable()
    type NullableProjection = projection.ProjectedType<typeof nullable, P>
    expectTypeOf<NullableProjection>().toEqualTypeOf(projected.nullable())

    const array = model.array()
    type ArrayProjection = projection.ProjectedType<typeof array, P>
    expectTypeOf<ArrayProjection>().toEqualTypeOf(projected.array())

    const reference = model.reference()
    type ReferenceProjection = projection.ProjectedType<typeof reference, P>
    expectTypeOf<ReferenceProjection>().toEqualTypeOf(projected)
  })
})

describe('projection.projectedType', () => {
  test('returns the same type when given a true projection', () => {
    const projectedType = projection.projectedType(types.number, true)
    expectSameTypes(projectedType, types.number())
  })

  test('cannot be called with a base type and an object', () => {
    expect(() => projection.projectedType(types.number, {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.string, {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.literal(true), {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.literal(false), {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.literal(1), {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.literal(''), {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.literal(null), {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(types.boolean, {} as any)).toThrowError(/.*\[internal error\].*/)
    expect(() => projection.projectedType(exampleCustom, {} as any)).toThrowError(/.*\[internal error\].*/)
  })

  test('returns an array of projections when called on array', () => {
    const model = types.object({ field1: types.number, field2: types.string }).array()
    const projectedType = projection.projectedType(model, { field1: true })
    const expectedProjection = types.object({ field1: types.number }).array()
    expectSameTypes(projectedType, expectedProjection)
  })

  test('returns an optional projection when called on optional value', () => {
    const model = types.object({ field1: types.number, field2: types.string }).optional()
    const projectedType = projection.projectedType(model, { field1: true })
    const expectedProjection = types.object({ field1: types.number }).optional()
    expectSameTypes(projectedType, expectedProjection)
  })

  test('returns a nullable projection when called on nullable value', () => {
    const model = types.object({ field1: types.number, field2: types.string }).nullable()
    const projectedType = projection.projectedType(model, { field1: true })
    const expectedProjection = types.object({ field1: types.number }).nullable()
    expectSameTypes(projectedType, expectedProjection)
  })

  test('returns the inner projection when called on reference value', () => {
    const model = types.object({ field1: types.number, field2: types.string }).reference()
    const projectedType = projection.projectedType(model, { field1: true })
    const expectedProjection = types.object({ field1: types.number })
    expectSameTypes(projectedType, expectedProjection)
  })

  test('returns a union of projected variants when called on union', () => {
    const model = types.union({
      variant1: types.string,
      variant2: types.object({
        field1: types.boolean,
        field2: types.number,
      }),
      variant3: types.boolean,
    })
    const p = {
      variant1: true as true,
      variant2: {
        field1: true as true,
      },
    }

    const projectedType = projection.projectedType(model, p)
    const expectedProjection = types.union({
      variant1: types.string(),
      variant2: types.object({ field1: types.boolean }),
    })

    expectSameTypes(projectedType, expectedProjection)
  })
})

describe('projection.Infer', () => {
  test('is true for base types', () => {
    expectTypeOf<projection.Infer<types.NumberType>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<types.StringType>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<types.BooleanType>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<types.EnumType<['one', 'two']>>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<typeof exampleCustom>>().toEqualTypeOf(true as const)

    expectTypeOf<projection.Infer<types.LiteralType<null>>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<types.LiteralType<'string'>>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<types.LiteralType<true>>>().toEqualTypeOf(true as const)
    expectTypeOf<projection.Infer<types.LiteralType<1>>>().toEqualTypeOf(true as const)
  })

  test('is a correct object for ObjectType', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Inferred = projection.Infer<typeof model>
    type Expected = true | { readonly field1?: true; readonly field2?: true }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = types.object({ field1: types.object({ nested: types.number() }) })
    type Inferred = projection.Infer<typeof model>
    type Expected = true | { readonly field1?: true | { readonly nested?: true } }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = types.union({ variant1: types.number, variant2: types.string })
    type Inferred = projection.Infer<typeof model>
    type Expected = true | { readonly variant1?: true; readonly variant2?: true }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = types.union({ variant1: types.number, variant2: types.union({ subvariant1: types.number() }) })
    type Inferred = projection.Infer<typeof model>
    type Expected = true | { readonly variant1?: true; readonly variant2?: true | { readonly subvariant1?: true } }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Expected = true | { readonly field1?: true; readonly field2?: true }

    const optionalObject = model.optional()
    const optionalNumber = types.number().optional()
    expectTypeOf<projection.Infer<typeof optionalObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.Infer<typeof optionalNumber>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = types.number().nullable()
    expectTypeOf<projection.Infer<typeof nullableObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.Infer<typeof nullableNumber>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = types.number().reference()
    expectTypeOf<projection.Infer<typeof objectReference>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.Infer<typeof numberReference>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = types.number().array()
    expectTypeOf<projection.Infer<typeof objectArray>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.Infer<typeof numberArray>>().toEqualTypeOf<true>()
  })
})
