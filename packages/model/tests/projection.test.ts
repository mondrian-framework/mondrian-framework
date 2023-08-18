import { projection, types, decoder, validator, path, arbitrary } from '../src'
import { areSameArray } from '../src/utils'
import { checkError, checkValue } from './decoder.test'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
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
    expectTypeOf<projection.FromType<types.NumberType>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.StringType>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.BooleanType>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.EnumType<['one', 'two']>>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<typeof exampleCustom>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.LiteralType<null>>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.LiteralType<'string'>>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.LiteralType<true>>>().toEqualTypeOf<true>()
    expectTypeOf<projection.FromType<types.LiteralType<1>>>().toEqualTypeOf<true>()
  })

  test('is a correct object for ObjectType', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Inferred = projection.FromType<typeof model>
    type Expected = true | { readonly field1?: true; readonly field2?: true }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('works on nested objects', () => {
    const model = types.object({ field1: types.object({ nested: types.number() }) })
    type Inferred = projection.FromType<typeof model>
    type Expected = true | { readonly field1?: true | { readonly nested?: true } }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('is a correct object for UnionType', () => {
    const model = types.union({ variant1: types.number, variant2: types.string })
    type Inferred = projection.FromType<typeof model>
    type Expected = true | { readonly variant1?: true; readonly variant2?: true }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = types.union({ variant1: types.number, variant2: types.union({ subvariant1: types.number() }) })
    type Inferred = projection.FromType<typeof model>
    type Expected = true | { readonly variant1?: true; readonly variant2?: true | { readonly subvariant1?: true } }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = types.object({ field1: types.number, field2: types.number })
    type Expected = true | { readonly field1?: true; readonly field2?: true }

    const optionalObject = model.optional()
    const optionalNumber = types.number().optional()
    expectTypeOf<projection.FromType<typeof optionalObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof optionalNumber>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = types.number().nullable()
    expectTypeOf<projection.FromType<typeof nullableObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof nullableNumber>>().toEqualTypeOf<true>()

    const objectReference = model.reference()
    const numberReference = types.number().reference()
    expectTypeOf<projection.FromType<typeof objectReference>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof numberReference>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = types.number().array()
    expectTypeOf<projection.FromType<typeof objectArray>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof numberArray>>().toEqualTypeOf<true>()
  })
})

describe('projection.depth', () => {
  test('is zero for true/{} projections', () => {
    expect(projection.depth(true)).toBe(0)
    expect(projection.depth({})).toBe(0)
  })

  test('is the maximum depth of an object', () => {
    expect(projection.depth({ field: true })).toBe(1)
    expect(projection.depth({ field1: undefined })).toBe(1)
    expect(projection.depth({ field1: undefined, field2: true })).toBe(1)
    expect(projection.depth({ field1: true, field2: { subfield: true } })).toBe(2)
    expect(projection.depth({ field1: { subfield1: true }, field2: { subfield2: { subsubfield2: true } } })).toBe(3)
  })
})

describe('projection.Selector', () => {
  test('is never for true/{} projections', () => {
    expectTypeOf<projection.Selector<true>>().toEqualTypeOf<never>()
    expectTypeOf<projection.Selector<{}>>().toEqualTypeOf<never>()
  })

  test('is an arrays of the keys of a simple object', () => {
    type Projection = { field1?: true; field2?: true }
    type Selector = projection.Selector<Projection>
    expectTypeOf<Selector>().toEqualTypeOf<['field1'] | ['field2']>()
  })

  test('enumerates all possible ways to access the (sub)fields of a complex object', () => {
    type Projection = { field1?: true; field2?: { subfield1?: true; subfield2?: true } }
    type Selector = projection.Selector<Projection>
    type Expected = ['field1'] | ['field2'] | ['field2', 'subfield1'] | ['field2', 'subfield2']
    expectTypeOf<Selector>().toEqualTypeOf<Expected>()
  })
})

describe('projection.SubProjection', () => {
  test("is always never for true/{} since they don't have subprojections", () => {
    expectTypeOf<projection.SubProjection<true, never>>().toEqualTypeOf<never>()
    expectTypeOf<projection.SubProjection<{}, never>>().toEqualTypeOf<never>()
  })

  test('is the type of the field selected by the selector', () => {
    type Projection = { field1?: true; field2?: true | { subfield1?: true; subfield2?: true } }
    type Field2 = undefined | true | { subfield1?: true; subfield2?: true }
    expectTypeOf<projection.SubProjection<Projection, ['field1']>>().toEqualTypeOf<true | undefined>()
    expectTypeOf<projection.SubProjection<Projection, ['field2']>>().toEqualTypeOf<Field2>()
    expectTypeOf<projection.SubProjection<Projection, ['field2', 'subfield1']>>().toEqualTypeOf<true | undefined>()
    expectTypeOf<projection.SubProjection<Projection, ['field2', 'subfield2']>>().toEqualTypeOf<true | undefined>()
  })
})

describe('projection.subProjection', () => {
  type Projection = true | { field1?: true; field2?: true | { subfield1?: true; subfield2?: true } }

  test('returns true if called on true projection', () => {
    expect(projection.subProjection(true as Projection, ['field1'])).toEqual(true)
    expect(projection.subProjection(true as Projection, ['field2'])).toEqual(true)
    expect(projection.subProjection(true as Projection, ['field2', 'subfield1'])).toEqual(true)
    expect(projection.subProjection(true as Projection, ['field2', 'subfield2'])).toEqual(true)
  })

  test('returns undefined if called on {} projection', () => {
    expect(projection.subProjection({} as Projection, ['field1'])).toEqual(undefined)
    expect(projection.subProjection({} as Projection, ['field2'])).toEqual(undefined)
    expect(projection.subProjection({} as Projection, ['field2', 'subfield1'])).toEqual(undefined)
    expect(projection.subProjection({} as Projection, ['field2', 'subfield2'])).toEqual(undefined)
  })

  const trueOrUndefined = gen.constantFrom(true as const, undefined)
  const field2 = gen.record({ subfield1: trueOrUndefined, subfield2: trueOrUndefined })
  const projectionGenerator: gen.Arbitrary<Exclude<Projection, true | undefined>> = field2.chain((field2) => {
    return gen.record({ field1: trueOrUndefined, field2: gen.constantFrom(true as const, undefined, field2) })
  })

  test.prop([projectionGenerator])('returns the selected field', (p) => {
    expect(projection.subProjection(p, ['field1'])).toBe(p.field1)
    expect(projection.subProjection(p, ['field2'])).toBe(p.field2)

    if (p?.field2 === undefined) {
      expect(projection.subProjection(p, ['field2', 'subfield1'])).toBe(undefined)
      expect(projection.subProjection(p, ['field2', 'subfield2'])).toBe(undefined)
    } else if (p?.field2 === true) {
      expect(projection.subProjection(p, ['field2', 'subfield1'])).toBe(true)
      expect(projection.subProjection(p, ['field2', 'subfield2'])).toBe(true)
    } else {
      expect(projection.subProjection(p, ['field2', 'subfield1'])).toBe(p.field2.subfield1)
      expect(projection.subProjection(p, ['field2', 'subfield2'])).toBe(p.field2.subfield2)
    }
  })
})

const wrapperTypeAndValue = arbitrary
  .wrapperType(3, arbitrary.baseType())
  .filter(arbitrary.canGenerateValueFrom)
  .chain((type) => {
    return arbitrary.fromType(type, {}).map((value) => {
      return [type, value] as const
    })
  })

const baseTypeAndValue = arbitrary
  .baseType()
  .filter(arbitrary.canGenerateValueFrom)
  .chain((type) => {
    return arbitrary.fromType(type, {}).map((value) => {
      return [type, value] as const
    })
  })

describe('projection.respectsProjection', () => {
  test.prop([baseTypeAndValue])('works on base types', ([type, value]) => {
    assertOk(projection.respectsProjection(type, true as never, value))
  })

  test.prop([wrapperTypeAndValue])('works on wrapper types', ([type, value]) => {
    assertOk(projection.respectsProjection(type, true as never, value))
  })

  test.prop([arbitrary.typeAndValue()])('always works on any type, if projection is true', ([type, value]) => {
    assertOk(projection.respectsProjection(type, true as never, value))
  })

  test('fails with an internal error when called on an unhandled type', () => {
    const unhandledType = { kind: 'not a type' } as unknown as types.Type
    expect(() => projection.respectsProjection(unhandledType, true as never, null as never)).toThrow(
      /\[internal error\]/,
    )
  })

  describe('reports missing required fields', () => {
    test('from arrays', () => {
      const model = types.object({ field1: types.number(), field2: types.string() }).array()
      const value = [{ field1: 1 }, { field2: 'hello' }, { field1: 2, field2: 'hi' }, {}]
      const p = { field1: true } as const
      const result = projection.respectsProjection(model, p, value)
      const actualError = assertFailure(result)
      const expectedError = [
        { missingField: 'field1', path: path.empty().appendIndex(1) },
        { missingField: 'field1', path: path.empty().appendIndex(3) },
      ]
      checkErrors(expectedError, actualError)
    })

    test('from objects', () => {
      const model = types.object({ field1: types.number(), field2: types.string() })
      const result = projection.respectsProjection(model, { field2: true }, {})
      const actualError = assertFailure(result)
      const expectedError = [{ missingField: 'field2', path: path.empty() }]
      checkErrors(expectedError, actualError)
    })

    test('from objects with optional field', () => {
      const model = types.object({ field1: types.number(), field2: types.string().optional(), field3: types.string() })
      const result = projection.respectsProjection(model, { field2: true, field3: true }, {})
      const actualError = assertFailure(result)
      const expectedError = [{ missingField: 'field3', path: path.empty() }]
      checkErrors(expectedError, actualError)
    })

    test('from objects with reference field', () => {
      const model = () =>
        types.object({ field1: types.reference(model), field2: types.string().optional(), field3: types.string() })
      const result = projection.respectsProjection(model, true, { field3: 'ok' })
      assertOk(result)
    })

    test('from union with reference field', () => {
      const model = () =>
        types.union({ field1: types.reference(model), field2: types.string().optional(), field3: types.string() })
      const result = projection.respectsProjection(model, true, { field1: { field3: 'ok' } })
      assertOk(result)
    })

    test('from union with empty object', () => {
      const model = () =>
        types.union({
          field1: types.object({ field4: types.string() }),
          field2: types.string().optional(),
          field3: types.string(),
        })
      assertOk(projection.respectsProjection(model, {}, { field1: {} }))
      assertOk(projection.respectsProjection(model, {}, { field2: undefined }))
      assertOk(projection.respectsProjection(model, {}, { field3: 'asd' }))
    })

    test('from unions', () => {
      const model = types.union({
        variant1: types.string(),
        variant2: types.object({
          field1: types.string(),
          field2: types.string(),
        }),
      })
      const value = { variant2: {} }
      const p = { variant1: true, variant2: { field1: true } } as const
      const result = projection.respectsProjection(model, p, value)
      const actualError = assertFailure(result)
      const expectedError = [{ missingField: 'field1', path: path.empty().appendVariant('variant2') }]
      checkErrors(expectedError, actualError)
    })
  })
})

function checkErrors(actual: projection.Error[], expected: projection.Error[]) {
  const compareProjectionErrors = (one: projection.Error, other: projection.Error) => {
    return one.missingField === other.missingField && one.path.equals(other.path)
  }
  expect(areSameArray(actual, expected, compareProjectionErrors)).toBe(true)
}

describe('decode', () => {
  const model = () =>
    types.object({ field1: types.string(), field2: types.union({ type: model, base: types.literal(null) }) })

  test('works with true', () => {
    checkValue(projection.decode(model, true), true)
    checkValue(projection.decode(types.string().nullable(), true), true)
  })

  test('works with 1 when casting', () => {
    checkValue(projection.decode(model, 1, { typeCastingStrategy: 'tryCasting' }), true)
  })

  test('works with "true" when casting', () => {
    checkValue(projection.decode(model, 'true', { typeCastingStrategy: 'tryCasting' }), true)
  })

  test('works with empty object', () => {
    checkValue(projection.decode(model, {}), {})
  })

  test('works with fields that are not on the model', () => {
    checkValue(projection.decode(model, { field3: true }), {})
  })

  test('works with one field only', () => {
    checkValue(projection.decode(model, { field1: true }), { field1: true })
  })

  test('works with union', () => {
    checkValue(projection.decode(model, { field2: { type: { field1: true } } }), { field2: { type: { field1: true } } })
  })

  test('fails with false', () => {
    const expectedError = [
      { expected: 'literal (true)', got: false, path: path.empty() },
      { expected: 'object', got: false, path: path.empty() },
    ]
    const result = projection.decode(model, false)
    checkError(result, expectedError)
  })

  test('fails with "true" while not casting', () => {
    const expectedError = [
      { expected: 'literal (true)', got: 'true', path: path.empty() },
      { expected: 'object', got: 'true', path: path.empty() },
    ]
    const result = projection.decode(model, 'true')
    checkError(result, expectedError)
  })

  test('fails with 1 while not casting', () => {
    const expectedError = [
      { expected: 'literal (true)', got: 1, path: path.empty() },
      { expected: 'object', got: 1, path: path.empty() },
    ]
    const result = projection.decode(model, 1)
    checkError(result, expectedError)
  })

  test('fails with 0 and casting', () => {
    const expectedError = [
      { expected: 'literal (true)', got: 0, path: path.empty() },
      { expected: 'object', got: 0, path: path.empty() },
    ]
    const result = projection.decode(model, 0, { typeCastingStrategy: 'tryCasting' })
    checkError(result, expectedError)
  })

  test('fails with "false" and casting', () => {
    const expectedError = [
      { expected: 'literal (true)', got: 'false', path: path.empty() },
      { expected: 'object', got: 'false', path: path.empty() },
    ]
    const result = projection.decode(model, 'false', { typeCastingStrategy: 'tryCasting' })
    checkError(result, expectedError)
  })

  test('fails with false in fields', () => {
    const expectedError = [{ expected: 'literal (true)', got: false, path: path.empty().prependField('field1') }]
    const result = projection.decode(model, { field1: false, field2: false })
    checkError(result, expectedError)
  })

  test('fails with false in fields with exaustive errors', () => {
    const expectedError = [
      { expected: 'literal (true)', got: false, path: path.empty().prependField('field1') },
      { expected: 'literal (true)', got: false, path: path.empty().prependField('field2') },
      { expected: 'object', got: false, path: path.empty().prependField('field2') },
    ]
    const result = projection.decode(model, { field1: false, field2: false }, { errorReportingStrategy: 'allErrors' })
    checkError(result, expectedError)
  })

  test('fails with false in a field that could be true or object', () => {
    const expectedError = [
      { expected: 'literal (true)', got: false, path: path.empty().prependField('field2') },
      { expected: 'object', got: false, path: path.empty().prependField('field2') },
    ]
    const result = projection.decode(model, { field2: false })
    checkError(result, expectedError)
  })
})

//describe('projection.FromType', () => {
//
//describe('projection.fromType', () => {
//  test('returns the types.literal true for base types', () => {
//    expectSameTypes(projection.fromType(types.number), types.literal(true))
//    expectSameTypes(projection.fromType(types.boolean), types.literal(true))
//    expectSameTypes(projection.fromType(types.string), types.literal(true))
//    expectSameTypes(projection.fromType(types.enumeration(['a', 'b'])), types.literal(true))
//    expectSameTypes(projection.fromType(types.literal(1)), types.literal(true))
//    expectSameTypes(projection.fromType(types.literal('a')), types.literal(true))
//    expectSameTypes(projection.fromType(types.literal(true)), types.literal(true))
//    expectSameTypes(projection.fromType(types.literal(false)), types.literal(true))
//    expectSameTypes(projection.fromType(types.literal(null)), types.literal(true))
//    expectSameTypes(projection.fromType(exampleCustom), types.literal(true))
//  })
//
//  test('returns an object model for objects', () => {
//    const model = types.object({
//      field1: types.number,
//      field2: types.object({
//        inner1: types.string,
//      }),
//    })
//
//    const expectedProjectionModel = types.union({
//      all: types.literal(true),
//      partial: types.object({
//        field1: types.literal(true).optional(),
//        field2: types
//          .union({
//            all: types.literal(true),
//            partial: types.object({
//              inner1: types.literal(true).optional(),
//            }),
//          })
//          .optional(),
//      }),
//    })
//
//    expectSameTypes(projection.fromType(model), expectedProjectionModel)
//  })
//
//  test('returns an object model for unions', () => {
//    const model = types.union({
//      variant1: types.number,
//      variant2: types.object({
//        inner1: types.string,
//      }),
//    })
//
//    const expectedProjectionModel = types.union({
//      all: types.literal(true),
//      partial: types.object({
//        variant1: types.literal(true).optional(),
//        variant2: types
//          .union({
//            all: types.literal(true),
//            partial: types.object({
//              inner1: types.literal(true).optional(),
//            }),
//          })
//          .optional(),
//      }),
//    })
//
//    expectSameTypes(projection.fromType(model), expectedProjectionModel)
//  })
//
//  test("returns the projection of an array's wrapped type", () => {
//    const model = types.object({ field1: types.number }).array()
//    const arrayProjection = projection.fromType(model)
//    const wrappedTypeProjection = projection.fromType(model.wrappedType)
//    expectSameTypes(arrayProjection, wrappedTypeProjection)
//  })
//
//  test("returns the projection of an optional's wrapped type", () => {
//    const model = types.object({ field1: types.number }).optional()
//    const arrayProjection = projection.fromType(model)
//    const wrappedTypeProjection = projection.fromType(model.wrappedType)
//    expectSameTypes(arrayProjection, wrappedTypeProjection)
//  })
//
//  test("returns the projection of a nullable's wrapped type", () => {
//    const model = types.object({ field1: types.number }).nullable()
//    const arrayProjection = projection.fromType(model)
//    const wrappedTypeProjection = projection.fromType(model.wrappedType)
//    expectSameTypes(arrayProjection, wrappedTypeProjection)
//  })
//
//  test("returns the projection of a reference's wrapped type", () => {
//    const model = types.object({ field1: types.number }).reference()
//    const arrayProjection = projection.fromType(model)
//    const wrappedTypeProjection = projection.fromType(model.wrappedType)
//    expectSameTypes(arrayProjection, wrappedTypeProjection)
//  })
//})
//
//describe('projection.ProjectionKeys', () => {
//  test('returns never for types.literal projections', () => {
//    expectTypeOf<projection.ProjectionKeys<types.LiteralType<true>>>().toEqualTypeOf<never>()
//  })
//
//  test('returns a union of strings for an object projection', () => {
//    const model = types.object({ field1: types.number, field2: types.object({ inner1: types.boolean }) })
//    type Projection = projection.FromType<typeof model>
//    expectTypeOf<projection.ProjectionKeys<Projection>>().toEqualTypeOf<'field1' | 'field2'>()
//  })
//})
//
//describe('projection.SubProjection', () => {
//  test('returns never for types.literal projections', () => {
//    expectTypeOf<projection.SubProjection<types.LiteralType<true>, never>>().toEqualTypeOf<never>()
//  })
//
//  test('returns subprojection for union projection', () => {
//    const model = types.object({ field1: types.number, field2: types.object({ inner: types.boolean }) })
//    type Projection = projection.FromType<typeof model>
//    expectTypeOf<projection.SubProjection<Projection, 'field1'>>().toEqualTypeOf(types.literal(true).optional())
//
//    const expectedProjection = types
//      .union({
//        all: types.literal(true),
//        partial: types.object({ inner: types.literal(true).optional() }),
//      })
//      .optional()
//    expectTypeOf<projection.SubProjection<Projection, 'field2'>>().toEqualTypeOf(expectedProjection)
//  })
//})
//
//describe('projection.subProjection', () => {
//  test('returns the sub object when provided the corresponding key', () => {
//    const model = types.object({ field1: types.number, field2: types.object({ inner1: types.string }) })
//    const subProjectionOnField1 = projection.subProjection(projection.fromType(model), 'field1')
//    expectSameTypes(subProjectionOnField1, types.literal(true).optional())
//
//    const subProjectionOnField2 = projection.subProjection(projection.fromType(model), 'field2')
//    const expectedSubProjection = types
//      .union({
//        all: types.literal(true),
//        partial: types.object({ inner1: types.literal(true).optional() }),
//      })
//      .optional()
//    expectSameTypes(subProjectionOnField2, expectedSubProjection)
//  })
//
//  test('cannot be called on true projections', () => {
//    expect(() => projection.subProjection(types.literal(true), {} as never)).toThrowError(/.*\[internal error\].*/)
//  })
//})
//
//
//describe('projection.ProjectedType', () => {
//  test('when the projection is true is returns the given type', () => {
//    type Projected = projection.ProjectedType<types.NumberType, true>
//    expectTypeOf<Projected>().toEqualTypeOf(types.number())
//
//    const model = types.object({ field: types.boolean })
//    type Projected1 = projection.ProjectedType<typeof model, true>
//    expectTypeOf<Projected1>().toEqualTypeOf(model)
//  })
//
//  test('when the projection is an object it projects the keys', () => {
//    const model = types.object({
//      field1: types.number(),
//      field2: types.boolean().optional(),
//      field3: types.object({ inner1: types.string, inner2: types.boolean }),
//    })
//
//    type Projection = { field1: true; field3: { inner2: true } }
//    const expected = types.object({
//      field1: types.number(),
//      field3: types.object({ inner2: types.boolean() }),
//    })
//    type Projected = projection.ProjectedType<typeof model, Projection>
//    expectTypeOf<Projected>().toEqualTypeOf(expected)
//  })
//
//  test('an empty projection returns an empty object type', () => {
//    const model = types.object({ field1: types.number(), field2: types.number() })
//    type Projected = projection.ProjectedType<typeof model, {}>
//    expectTypeOf<Projected>().toEqualTypeOf(types.object({}))
//  })
//
//  test('a projection on a union is the projection of its variants', () => {
//    const model = types.union({ variant1: types.number(), variant2: types.object({ field: types.string() }) })
//    type P1 = { variant1: true }
//    type UnionProjection1 = projection.ProjectedType<typeof model, P1>
//    const projected1 = types.union({ variant1: types.number() })
//    expectTypeOf<UnionProjection1>().toEqualTypeOf(projected1)
//
//    type P2 = { variant1: true; variant2: { field: true } }
//    type UnionProjection2 = projection.ProjectedType<typeof model, P2>
//    expectTypeOf<UnionProjection2>().toEqualTypeOf(model)
//  })
//
//  test('when the object is a wrapper the projected type is itself wrapped', () => {
//    const model = types.object({ field1: types.string(), field2: types.number() })
//    const projected = types.object({ field1: types.string() })
//    type P = { field1: true }
//
//    const optional = model.optional()
//    type OptionalProjection = projection.ProjectedType<typeof optional, P>
//    expectTypeOf<OptionalProjection>().toEqualTypeOf(projected.optional())
//
//    const nullable = model.nullable()
//    type NullableProjection = projection.ProjectedType<typeof nullable, P>
//    expectTypeOf<NullableProjection>().toEqualTypeOf(projected.nullable())
//
//    const array = model.array()
//    type ArrayProjection = projection.ProjectedType<typeof array, P>
//    expectTypeOf<ArrayProjection>().toEqualTypeOf(projected.array())
//
//    const reference = model.reference()
//    type ReferenceProjection = projection.ProjectedType<typeof reference, P>
//    expectTypeOf<ReferenceProjection>().toEqualTypeOf(projected)
//  })
//})
//
//describe('projection.projectedType', () => {
//  test('returns the same type when given a true projection', () => {
//    const projectedType = projection.projectedType(types.number, true)
//    expectSameTypes(projectedType, types.number())
//  })
//
//  test('cannot be called with a base type and an object', () => {
//    expect(() => projection.projectedType(types.number, {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.string, {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.literal(true), {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.literal(false), {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.literal(1), {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.literal(''), {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.literal(null), {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(types.boolean, {} as any)).toThrowError(/.*\[internal error\].*/)
//    expect(() => projection.projectedType(exampleCustom, {} as any)).toThrowError(/.*\[internal error\].*/)
//  })
//
//  test('returns an array of projections when called on array', () => {
//    const model = types.object({ field1: types.number, field2: types.string }).array()
//    const projectedType = projection.projectedType(model, { field1: true })
//    const expectedProjection = types.object({ field1: types.number }).array()
//    expectSameTypes(projectedType, expectedProjection)
//  })
//
//  test('returns an optional projection when called on optional value', () => {
//    const model = types.object({ field1: types.number, field2: types.string }).optional()
//    const projectedType = projection.projectedType(model, { field1: true })
//    const expectedProjection = types.object({ field1: types.number }).optional()
//    expectSameTypes(projectedType, expectedProjection)
//  })
//
//  test('returns a nullable projection when called on nullable value', () => {
//    const model = types.object({ field1: types.number, field2: types.string }).nullable()
//    const projectedType = projection.projectedType(model, { field1: true })
//    const expectedProjection = types.object({ field1: types.number }).nullable()
//    expectSameTypes(projectedType, expectedProjection)
//  })
//
//  test('returns the inner projection when called on reference value', () => {
//    const model = types.object({ field1: types.number, field2: types.string }).reference()
//    const projectedType = projection.projectedType(model, { field1: true })
//    const expectedProjection = types.object({ field1: types.number })
//    expectSameTypes(projectedType, expectedProjection)
//  })
//
//  test('returns a union of projected variants when called on union', () => {
//    const model = types.union({
//      variant1: types.string,
//      variant2: types.object({
//        field1: types.boolean,
//        field2: types.number,
//      }),
//      variant3: types.boolean,
//    })
//    const p = {
//      variant1: true as true,
//      variant2: {
//        field1: true as true,
//      },
//    }
//
//    const projectedType = projection.projectedType(model, p)
//    const expectedProjection = types.union({
//      variant1: types.string(),
//      variant2: types.object({ field1: types.boolean }),
//    })
//
//    expectSameTypes(projectedType, expectedProjection)
//  })
//})
//
//describe('projection.Infer', () => {
//  test('is true for base types', () => {
//    expectTypeOf<projection.Infer<types.NumberType>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<types.StringType>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<types.BooleanType>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<types.EnumType<['one', 'two']>>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<typeof exampleCustom>>().toEqualTypeOf(true as const)
//
//    expectTypeOf<projection.Infer<types.LiteralType<null>>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<types.LiteralType<'string'>>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<types.LiteralType<true>>>().toEqualTypeOf(true as const)
//    expectTypeOf<projection.Infer<types.LiteralType<1>>>().toEqualTypeOf(true as const)
//  })
//
//  test('is a correct object for ObjectType', () => {
//    const model = types.object({ field1: types.number, field2: types.number })
//    type Inferred = projection.Infer<typeof model>
//    type Expected = true | { readonly field1?: true; readonly field2?: true }
//    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
//  })
//
//  test('works on nested objects', () => {
//    const model = types.object({ field1: types.object({ nested: types.number() }) })
//    type Inferred = projection.Infer<typeof model>
//    type Expected = true | { readonly field1?: true | { readonly nested?: true } }
//    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
//  })
//
//  test('is a correct object for UnionType', () => {
//    const model = types.union({ variant1: types.number, variant2: types.string })
//    type Inferred = projection.Infer<typeof model>
//    type Expected = true | { readonly variant1?: true; readonly variant2?: true }
//    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
//  })
//
//  test('works on nested unions', () => {
//    const model = types.union({ variant1: types.number, variant2: types.union({ subvariant1: types.number() }) })
//    type Inferred = projection.Infer<typeof model>
//    type Expected = true | { readonly variant1?: true; readonly variant2?: true | { readonly subvariant1?: true } }
//    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
//  })
//
//  test('is the same as the projection for a wrapped type', () => {
//    const model = types.object({ field1: types.number, field2: types.number })
//    type Expected = true | { readonly field1?: true; readonly field2?: true }
//
//    const optionalObject = model.optional()
//    const optionalNumber = types.number().optional()
//    expectTypeOf<projection.Infer<typeof optionalObject>>().toEqualTypeOf<Expected>()
//    expectTypeOf<projection.Infer<typeof optionalNumber>>().toEqualTypeOf<true>()
//
//    const nullableObject = model.nullable()
//    const nullableNumber = types.number().nullable()
//    expectTypeOf<projection.Infer<typeof nullableObject>>().toEqualTypeOf<Expected>()
//    expectTypeOf<projection.Infer<typeof nullableNumber>>().toEqualTypeOf<true>()
//
//    const objectReference = model.reference()
//    const numberReference = types.number().reference()
//    expectTypeOf<projection.Infer<typeof objectReference>>().toEqualTypeOf<Expected>()
//    expectTypeOf<projection.Infer<typeof numberReference>>().toEqualTypeOf<true>()
//
//    const objectArray = model.array()
//    const numberArray = types.number().array()
//    expectTypeOf<projection.Infer<typeof objectArray>>().toEqualTypeOf<Expected>()
//    expectTypeOf<projection.Infer<typeof numberArray>>().toEqualTypeOf<true>()
//  })
//})
//
//describe('projection.Project', () => {
//  test('is equal to types.Infer with true projection (without references)', () => {
//    expectTypeOf<projection.Project<types.NumberType, true>>().toEqualTypeOf<types.Infer<types.NumberType>>()
//    expectTypeOf<projection.Project<types.StringType, true>>().toEqualTypeOf<types.Infer<types.StringType>>()
//    expectTypeOf<projection.Project<types.BooleanType, true>>().toEqualTypeOf<types.Infer<types.BooleanType>>()
//    expectTypeOf<projection.Project<types.EnumType<['one', 'two']>, true>>().toEqualTypeOf<
//      types.Infer<types.EnumType<['one', 'two']>>
//    >()
//    expectTypeOf<projection.Project<typeof exampleCustom, true>>().toEqualTypeOf<types.Infer<typeof exampleCustom>>()
//    expectTypeOf<projection.Project<types.LiteralType<null>, true>>().toEqualTypeOf<
//      types.Infer<types.LiteralType<null>>
//    >()
//    expectTypeOf<projection.Project<types.LiteralType<'string'>, true>>().toEqualTypeOf<
//      types.Infer<types.LiteralType<'string'>>
//    >()
//    expectTypeOf<projection.Project<types.LiteralType<true>, true>>().toEqualTypeOf<
//      types.Infer<types.LiteralType<true>>
//    >()
//    expectTypeOf<projection.Project<types.LiteralType<1>, true>>().toEqualTypeOf<types.Infer<types.LiteralType<1>>>()
//    const t1 = types.object({ username: types.string(), password: types.string() })
//    expectTypeOf<projection.Project<typeof t1, true>>().toEqualTypeOf<types.Infer<typeof t1>>()
//    const t2 = types.union({ username: types.string(), password: types.string() })
//    expectTypeOf<projection.Project<typeof t2, true>>().toEqualTypeOf<types.Infer<typeof t2>>()
//    const user = () => types.object({ username: types.string(), password: types.string(), friends: types.array(user) })
//    expectTypeOf<projection.Project<typeof user, true>>().toEqualTypeOf<types.Infer<typeof user>>()
//  })
//
//  test('is a subset of types.Infer with some projection (without references)', () => {
//    const t1 = types.object({ username: types.string(), password: types.string() })
//    expectTypeOf<projection.Project<typeof t1, { username: true }>>().toEqualTypeOf<{ readonly username: string }>
//    const t2 = types.union({ user: t1, jwt: types.string() })
//    expectTypeOf<projection.Project<typeof t2, { user: { username: true }; jwt: true }>>().toEqualTypeOf<
//      { readonly user: { readonly username: string } } | { readonly jwt: string }
//    >()
//  })
//
//  test('is a subset of types.Infer when references are present', () => {
//    const user = () =>
//      types.object({
//        username: types.string(),
//        password: types.string(),
//        friends: types.array(user).reference(),
//        bestFriend: types.object({
//          note: types.string(),
//          friend: types.reference(user),
//        }),
//      })
//    type User = types.Infer<typeof user>
//
//    //TODO: projection.Project not working as expected
//    type Projection1 = projection.Project<typeof user, true>
//    type Expected1 = {
//      readonly username: string
//      readonly password: string
//      readonly friends: readonly User[] // TODO: this should be omitted as it's a reference and the projection does not explicitly specify it
//      readonly bestFriend: {
//        readonly note: string
//        readonly friend: User // TODO: this should be omitted as it's a reference and the projection does not explicitly specify it
//      }
//    }
//    expectTypeOf<Projection1>().toEqualTypeOf<Expected1>()
//
//    type Projection2 = projection.Project<typeof user, { bestFriend: { friend: true } }>
//    type Expected2 = {
//      readonly bestFriend: {
//        readonly friend: {
//          readonly username: string
//          readonly password: string
//          readonly friends: readonly User[] // TODO: this should be omitted as it's a reference and the projection does not explicitly specify it
//          readonly bestFriend: {
//            readonly note: string
//            readonly friend: User // TODO: this should be omitted as it's a reference and the projection does not explicitly specify it
//          }
//        }
//      }
//    }
//    expectTypeOf<Projection2>().toEqualTypeOf<Expected2>()
//  })
//})
