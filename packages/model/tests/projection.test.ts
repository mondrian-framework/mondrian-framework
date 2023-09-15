import { projection, types, decoding, validation, path, arbitrary } from '../src'
import { checkError, checkValue } from './decoder.test'
import { assertFailure, assertOk } from './testing-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { areSameArray } from '@mondrian-framework/utils'
import { expectTypeOf, describe, expect } from 'vitest'

// This is used for the tests on custom types to avoid repeating the long definition
const exampleCustom = types.custom(
  'customType',
  () => null,
  () => decoding.fail('test', 'test'),
  () => validation.fail('test', 'test'),
)

describe.concurrent('projection.FromType', () => {
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
    const model = types.object({ field1: types.number(), field2: types.number() })
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
    const model = types.union({ variant1: types.number(), variant2: types.string() })
    type Inferred = projection.FromType<typeof model>
    type Expected = true | { readonly variant1?: true; readonly variant2?: true }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('works on nested unions', () => {
    const model = types.union({ variant1: types.number(), variant2: types.union({ subvariant1: types.number() }) })
    type Inferred = projection.FromType<typeof model>
    type Expected = true | { readonly variant1?: true; readonly variant2?: true | { readonly subvariant1?: true } }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('is the same as the projection for a wrapped type', () => {
    const model = types.object({ field1: types.number(), field2: types.number() })
    type Expected = true | { readonly field1?: true; readonly field2?: true }

    const optionalObject = model.optional()
    const optionalNumber = types.number().optional()
    expectTypeOf<projection.FromType<typeof optionalObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof optionalNumber>>().toEqualTypeOf<true>()

    const nullableObject = model.nullable()
    const nullableNumber = types.number().nullable()
    expectTypeOf<projection.FromType<typeof nullableObject>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof nullableNumber>>().toEqualTypeOf<true>()

    const objectArray = model.array()
    const numberArray = types.number().array()
    expectTypeOf<projection.FromType<typeof objectArray>>().toEqualTypeOf<Expected>()
    expectTypeOf<projection.FromType<typeof numberArray>>().toEqualTypeOf<true>()
  })
})

describe.concurrent('projection.depth', () => {
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

describe.concurrent('projection.Selector', () => {
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

describe.concurrent('projection.SubProjection', () => {
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

describe.concurrent('projection.subProjection', () => {
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

describe.concurrent('projection.respectsProjection', () => {
  test.prop([baseTypeAndValue])('works on base types', ([type, value]) => {
    const result = assertOk(projection.respectsProjection(type, true as never, value))
    expect(result).toBe(value)
  })

  test.prop([wrapperTypeAndValue])('works on wrapper types', ([type, value]) => {
    const result = assertOk(projection.respectsProjection(type, true as never, value))
    expect(result).toEqual(value)
  })

  test.prop([arbitrary.typeAndValue()])('always works on any type, if projection is true', ([type, value]) => {
    const result = assertOk(projection.respectsProjection(type, true as never, value))
    expect(result).toEqual(value)
  })

  test('fails with an internal error when called on an unhandled type', () => {
    const unhandledType = { kind: 'not a type' } as unknown as types.Type
    expect(() => projection.respectsProjection(unhandledType, true as never, null as never)).toThrow(
      /\[internal error\]/,
    )
  })

  describe.concurrent('reports missing required fields', () => {
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
        types.object({ field1: { virtual: model }, field2: types.string().optional(), field3: types.string() })
      const result = projection.respectsProjection(model, true, { field3: 'ok' })
      assertOk(result)
    })

    test('from union with empty object', () => {
      const model = types.union({
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

  describe.concurrent('trim not requested fields', () => {
    test('from object', () => {
      const model = types.object({ field1: types.number(), field2: types.string().optional() })
      checkValue(projection.respectsProjection(model, {}, { field1: 1, field2: '' }), {})
      checkValue(projection.respectsProjection(model, { field1: true }, { field1: 1, field2: '' }), { field1: 1 })
      checkValue(projection.respectsProjection(model, { field2: true }, { field1: 1, field2: undefined }), {
        field2: undefined,
      })
    })
  })
})

function checkErrors(actual: projection.Error[], expected: projection.Error[]) {
  const compareProjectionErrors = (one: projection.Error, other: projection.Error) => {
    return one.missingField === other.missingField && one.path.equals(other.path)
  }
  expect(areSameArray(actual, expected, compareProjectionErrors)).toBe(true)
}

describe.concurrent('decode', () => {
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
