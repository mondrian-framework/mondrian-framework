import { types, decoding, validation } from '../../src'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe } from 'vitest'

describe('Infer', () => {
  test('NumberType inferred as number', () => {
    const model = types.number()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })

  test('StringType inferred as string', () => {
    const model = types.string()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<string>()
  })

  test('BooleanType inferred as boolean', () => {
    const model = types.boolean()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<boolean>()
  })

  test('DateTimeType inferred as Date', () => {
    const model = types.dateTime()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<Date>()
  })

  test('TimestampType inferred as Date', () => {
    const model = types.timestamp()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<Date>()
  })

  test('UnknownType inferred as unknown', () => {
    const model = types.unknown()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<unknown>()
  })

  test('EnumType inferred as enum', () => {
    const model = types.enumeration(['one', 'two', 'three'])
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<'one' | 'two' | 'three'>()
  })

  describe('LiteralType', () => {
    test('LiteralType of number inferred as literal number', () => {
      const model = types.literal(1)
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<1>()
    })

    test('LiteralType of string inferred as literal string', () => {
      const model = types.literal('mondrian')
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<'mondrian'>()
    })

    test('LiteralType of boolean inferred as literal boolean', () => {
      const model = types.literal(true)
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<true>()
    })

    test('LiteralType of null inferred as literal null', () => {
      const model = types.literal(null)
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<null>()
    })
  })

  describe('ObjectType', () => {
    test('immutable ObjectType inferred with immutable fields', () => {
      const model = types.object({
        field1: types.number(),
        field2: types.string(),
        field3: types.object({ inner: types.boolean() }).mutable(),
      })
      type Inferred = types.Infer<typeof model>
      type Expected = {
        readonly field1: number
        readonly field2: string
        readonly field3: {
          inner: boolean
        }
      }
      expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
    })

    test('mutable ObjectType inferred with mutable fields', () => {
      const model = types.mutableObject({
        field1: types.number(),
        field2: types.string(),
      })
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1: number; field2: string }>()
    })

    test('merged objects inferred as a single object', () => {
      const model = types.merge(types.object({ field1: types.string() }), types.object({ field2: types.number() }))
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1: string; readonly field2: number }>()
    })

    test('merged objects inferred as a mutable single object', () => {
      const model = types.merge(
        types.object({ field1: types.string() }),
        types.object({ field2: types.number() }),
        'mutable',
      )
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1: string; field2: number }>()
    })

    test("second object overrides the first object's fields", () => {
      const model = types.merge(types.object({ field: types.number() }), types.object({ field: types.string() }))
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field: string }>()
    })

    test('picked object fields inferred as single field object', () => {
      const model = types.pick(types.object({ field1: types.string(), field2: types.number() }), {
        field1: true,
        field2: undefined,
      })
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1: string }>()
    })

    test('picked object fields inferred as mutable single field object', () => {
      const model = types.pick(
        types.object({ field1: types.string(), field2: types.number() }),
        {
          field1: true,
        },
        'mutable',
      )
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1: string }>()
    })

    test('omitted object fields inferred as single field object', () => {
      const model = types.omit(types.object({ field1: types.string(), field2: types.number() }), {
        field2: true,
        field1: undefined,
      })
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1: string }>()
    })

    test('omitted object fields inferred as mutable single field object', () => {
      const model = types.omit(
        types.object({ field1: types.string(), field2: types.number() }),
        {
          field2: true,
        },
        'mutable',
      )
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1: string }>()
    })

    test('omitted object references inferred as single field object', () => {
      const model = types.omitReferences(types.object({ field1: types.string(), field2: types.number().reference() }))
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1: string }>()
    })

    test('omitted object references inferred as mutable single field object', () => {
      const model = types.omitReferences(
        types.object({ field1: types.string(), field2: types.number().reference() }),
        'mutable',
      )
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1: string }>()
    })

    test('partial of object inferred with every field optional', () => {
      const model = types.partial(
        types.object({ field1: types.string().nullable(), field2: types.number().optional().reference() }),
      )
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1?: string | null; readonly field2?: number }>()
    })

    test('partial of mutable object inferred with every field optional', () => {
      const model = types.partial(
        types.object({ field1: types.string().nullable(), field2: types.number().optional().reference() }),
        'mutable',
      )
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1?: string | null; field2?: number }>()
    })
  })

  describe('ArrayType', () => {
    test('immutable ArrayType inferred as readonly array', () => {
      const model = types.array(types.number())
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<readonly number[]>()
    })

    test('mutable ArrayType inferred as array', () => {
      const model = types.mutableArray(types.number())
      type Inferred = types.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<number[]>()
    })
  })

  test('OptionalType inferred as union with undefined', () => {
    const model = types.optional(types.number())
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number | undefined>()
  })

  test('NullableType inferred as union with null', () => {
    const model = types.nullable(types.number())
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number | null>()
  })

  test('Function returning type is inferred as the returned type', () => {
    const model = () => types.number()
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })

  test('ReferenceType inferred as the wrapped type', () => {
    const model = types.reference(types.number())
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })

  test('UnionType inferred as tagged union of types', () => {
    const model = types.union({
      variant1: types.string(),
      variant2: types.object({ field1: types.string(), field2: types.boolean() }),
      variant3: types.boolean(),
    })
    type Inferred = types.Infer<typeof model>
    type InferredObject = { readonly field1: string; readonly field2: boolean }
    type Expected =
      | { readonly variant1: string }
      | { readonly variant2: InferredObject }
      | { readonly variant3: boolean }
    expectTypeOf<Inferred>().toEqualTypeOf<Expected>()
  })

  test('CustomType inferred as the specified type', () => {
    const model = types.custom<'myCustomType', {}, number>(
      'myCustomType',
      () => null,
      () => decoding.fail('test', 'test'),
      () => validation.fail('test', 'test'),
    )
    type Inferred = types.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })
})
