import { projection, m } from '../src'
import { error } from '../src/result'
import { areSameType } from '../src/type-system'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe, expect } from 'vitest'

// This is used for the tests on custom types to avoid repeating the long definition
const exampleCustom = m.custom(
  'customType',
  () => null,
  () => error('test', 'test'),
  () => error('test', 'test'),
)

describe('Projection inference', () => {
  test('is true for base types', () => {
    expectTypeOf<projection.InferProjection<m.NumberType>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<m.StringType>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<m.BooleanType>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<m.EnumType<['one', 'two']>>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<typeof exampleCustom>>().toEqualTypeOf<m.LiteralType<true>>()

    expectTypeOf<projection.InferProjection<m.LiteralType<null>>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<m.LiteralType<'string'>>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<m.LiteralType<true>>>().toEqualTypeOf<m.LiteralType<true>>()
    expectTypeOf<projection.InferProjection<m.LiteralType<1>>>().toEqualTypeOf<m.LiteralType<true>>()
  })

  test('is a correct object for ObjectType', () => {
    const model = m.object({ field1: m.number, field2: m.number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }
    expectTypeOf<m.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = m.object({ field1: m.object({ nested: m.number() }) })
    type Expected = true | { readonly field1: true | undefined | { readonly nested: true | undefined } }
    expectTypeOf<m.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = m.union({ variant1: m.number, variant2: m.string })
    type Expected = true | { readonly variant1: true | undefined; readonly variant2: true | undefined }
    expectTypeOf<m.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = m.union({ variant1: m.number, variant2: m.union({ subvariant1: m.number() }) })
    type Expected =
      | true
      | {
          readonly variant1: true | undefined
          readonly variant2: true | undefined | { readonly subvariant1: true | undefined }
        }
    expectTypeOf<m.Infer<projection.InferProjection<typeof model>>>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = m.object({ field1: m.number, field2: m.number })
    type Expected = true | { readonly field1: true | undefined; readonly field2: true | undefined }

    const optionalObject = model.optional()
    const optionalNumber = m.number().optional()
    expectTypeOf<m.Infer<projection.InferProjection<typeof optionalObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<m.Infer<projection.InferProjection<typeof optionalNumber>>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = m.number().nullable()
    expectTypeOf<m.Infer<projection.InferProjection<typeof nullableObject>>>().toEqualTypeOf<Expected>()
    expectTypeOf<m.Infer<projection.InferProjection<typeof nullableNumber>>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = m.number().reference()
    expectTypeOf<m.Infer<projection.InferProjection<typeof objectReference>>>().toEqualTypeOf<Expected>()
    expectTypeOf<m.Infer<projection.InferProjection<typeof numberReference>>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = m.number().array()
    expectTypeOf<m.Infer<projection.InferProjection<typeof objectArray>>>().toEqualTypeOf<Expected>()
    expectTypeOf<m.Infer<projection.InferProjection<typeof numberArray>>>().toEqualTypeOf<true>()
  })

  test('can infer keys of projection object', () => {
    const model = m.object({
      field1: m.number,
      field2: m.object({ inner1: m.boolean }),
    })
    type ObjectProjection = projection.InferProjection<typeof model>
    expectTypeOf<projection.ProjectionKeys<ObjectProjection>>().toEqualTypeOf<'field1' | 'field2'>()
  })

  test('infers never as the keys of a base projection', () => {
    type LiteralProjection = projection.InferProjection<m.LiteralType<true>>
    expectTypeOf<projection.ProjectionKeys<LiteralProjection>>().toEqualTypeOf<never>()

    type NumberProjection = projection.InferProjection<typeof m.number>
    expectTypeOf<projection.ProjectionKeys<NumberProjection>>().toEqualTypeOf<never>()
  })
})

describe('projectionFromType', () => {
  test('returns the m.literal true for base types', () => {
    expect(areSameType(projection.fromType(m.number), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.boolean), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.string), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.enumeration(['a', 'b'])), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.literal(1)), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.literal('a')), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.literal(true)), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.literal(false)), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(m.literal(null)), m.literal(true))).toEqual(true)
    expect(areSameType(projection.fromType(exampleCustom), m.literal(true))).toEqual(true)
  })

  test('returns an object model for objects', () => {
    const model = m.object({
      field1: m.number,
      field2: m.object({
        inner1: m.string,
      }),
    })

    const expectedProjectionModel = m.union({
      all: m.literal(true),
      partial: m.object({
        field1: m.literal(true).optional(),
        field2: m
          .union({
            all: m.literal(true),
            partial: m.object({
              inner1: m.literal(true).optional(),
            }),
          })
          .optional(),
      }),
    })

    expect(areSameType(projection.fromType(model), expectedProjectionModel)).toEqual(true)
  })

  test('returns an object model for unions', () => {
    const model = m.union({
      variant1: m.number,
      variant2: m.object({
        inner1: m.string,
      }),
    })

    const expectedProjectionModel = m.union({
      all: m.literal(true),
      partial: m.object({
        variant1: m.literal(true).optional(),
        variant2: m
          .union({
            all: m.literal(true),
            partial: m.object({
              inner1: m.literal(true).optional(),
            }),
          })
          .optional(),
      }),
    })

    expect(areSameType(projection.fromType(model), expectedProjectionModel)).toEqual(true)
  })
})

describe('projection.ProjectionKeys', () => {
  test('returns never for m.literal projections', () => {
    expectTypeOf<projection.ProjectionKeys<m.LiteralType<true>>>().toEqualTypeOf<never>()
  })

  test('returns a union of strings for an object projection', () => {
    const model = m.object({ field1: m.number, field2: m.object({ inner1: m.boolean }) })
    type Projection = projection.InferProjection<typeof model>
    expectTypeOf<projection.ProjectionKeys<Projection>>().toEqualTypeOf<'field1' | 'field2'>()
  })
})

describe('projection.SubProjection', () => {
  test('returns never for m.literal projections', () => {
    expectTypeOf<projection.SubProjection<m.LiteralType<true>, never>>().toEqualTypeOf<never>()
  })

  test('returns subprojection for union projection', () => {
    const model = m.object({ field1: m.number, field2: m.object({ inner: m.boolean }) })
    type Projection = projection.InferProjection<typeof model>
    expectTypeOf<projection.SubProjection<Projection, 'field1'>>().toEqualTypeOf<m.OptionalType<m.LiteralType<true>>>()

    const expectedProjection = m
      .union({
        all: m.literal(true),
        partial: m.object({ inner: m.literal(true).optional() }),
      })
      .optional()
    expectTypeOf<projection.SubProjection<Projection, 'field2'>>().toEqualTypeOf(expectedProjection)
  })
})

describe('subProjection', () => {
  test('returns the sub object when provided the corresponding key', () => {
    const model = m.object({ field1: m.number, field2: m.object({ inner1: m.string }) })
    const p = projection.fromType(model)

    const subProjectionOnField1 = projection.subProjection(p, 'field1')
    expect(areSameType(subProjectionOnField1, m.literal(true).optional())).toBe(true)

    const subProjectionOnField2 = projection.subProjection(p, 'field2')
    const expectedSubProjection = m
      .union({
        all: m.literal(true),
        partial: m.object({ inner1: m.literal(true).optional() }),
      })
      .optional()
    expect(areSameType(subProjectionOnField2, expectedSubProjection)).toBe(true)
  })
})

describe('projection.depth', () => {
  test('is zero for true projections', () => {
    expect(projection.depth(projection.fromType(m.number))).toBe(0)
    expect(projection.depth(projection.fromType(m.boolean))).toBe(0)
    expect(projection.depth(projection.fromType(m.string))).toBe(0)
    expect(projection.depth(projection.fromType(m.enumeration(['a', 'b'])))).toBe(0)
    expect(projection.depth(projection.fromType(m.literal(1)))).toBe(0)
    expect(projection.depth(projection.fromType(m.literal('a')))).toBe(0)
    expect(projection.depth(projection.fromType(m.literal(true)))).toBe(0)
    expect(projection.depth(projection.fromType(m.literal(false)))).toBe(0)
    expect(projection.depth(projection.fromType(m.literal(null)))).toBe(0)
    expect(projection.depth(projection.fromType(exampleCustom))).toBe(0)
  })

  test('is the maximum depth for objects', () => {
    const model = m.object({
      field1: m.object({
        inner1: m.boolean,
        inner2: m.number,
      }),
      field2: m.string().optional(),
    })

    expect(projection.depth(projection.fromType(model))).toBe(2)
  })

  test('is the maximum depth for unions', () => {
    const model = m.union({
      variant1: m.string,
      variant2: m.object({
        inner1: m.number,
        inner2: m.union({ inner1: m.boolean }),
      }),
    })

    expect(projection.depth(projection.fromType(model))).toBe(3)
  })
})
