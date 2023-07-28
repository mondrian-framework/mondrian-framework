import {
  ProjectionKeys,
  InferProjection,
  projectionDepth,
  subProjection,
  projectionFromType,
  SubProjection,
} from '../src/projection'
import { error } from '../src/result'
import {
  BooleanType,
  EnumType,
  Infer,
  LiteralType,
  NumberType,
  ObjectType,
  OptionalType,
  StringType,
  areSameType,
  array,
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
    expectTypeOf<InferProjection<NumberType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<StringType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<BooleanType>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<EnumType<['one', 'two']>>>().toEqualTypeOf<LiteralType<true>>()
    expectTypeOf<InferProjection<typeof exampleCustom>>().toEqualTypeOf<LiteralType<true>>()

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

describe('projectionFromType', () => {
  test('returns the literal true for base types', () => {
    expect(areSameType(projectionFromType(number), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(boolean), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(string), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(enumeration(['a', 'b'])), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(literal(1)), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(literal('a')), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(literal(true)), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(literal(false)), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(literal(null)), literal(true))).toEqual(true)
    expect(areSameType(projectionFromType(exampleCustom), literal(true))).toEqual(true)
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

    expect(areSameType(projectionFromType(model), expectedProjectionModel)).toEqual(true)
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

    expect(areSameType(projectionFromType(model), expectedProjectionModel)).toEqual(true)
  })
})

describe('ProjectionKeys', () => {
  test('returns never for literal projections', () => {
    expectTypeOf<ProjectionKeys<LiteralType<true>>>().toEqualTypeOf<never>()
  })

  test('returns a union of strings for an object projection', () => {
    const model = object({ field1: number, field2: object({ inner1: boolean }) })
    type Projection = InferProjection<typeof model>
    expectTypeOf<ProjectionKeys<Projection>>().toEqualTypeOf<'field1' | 'field2'>()
  })
})

describe('SubProjection', () => {
  test('returns never for literal projections', () => {
    expectTypeOf<SubProjection<LiteralType<true>, never>>().toEqualTypeOf<never>()
  })

  test('returns subprojection for union projection', () => {
    const model = object({ field1: number, field2: object({ inner: boolean }) })
    type Projection = InferProjection<typeof model>
    expectTypeOf<SubProjection<Projection, 'field1'>>().toEqualTypeOf<OptionalType<LiteralType<true>>>()

    const expectedProjection = union({
      all: literal(true),
      partial: object({ inner: literal(true).optional() }),
    }).optional()
    expectTypeOf<SubProjection<Projection, 'field2'>>().toEqualTypeOf(expectedProjection)
  })
})

describe('subProjection', () => {
  test('returns the sub object when provided the corresponding key', () => {
    const model = object({ field1: number, field2: object({ inner1: string }) })
    const projection = projectionFromType(model)

    const subProjectionOnField1 = subProjection(projection, 'field1')
    expect(areSameType(subProjectionOnField1, literal(true).optional())).toBe(true)

    const subProjectionOnField2 = subProjection(projection, 'field2')
    const expectedSubProjection = union({
      all: literal(true),
      partial: object({ inner1: literal(true).optional() }),
    }).optional()
    expect(areSameType(subProjectionOnField2, expectedSubProjection)).toBe(true)
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
