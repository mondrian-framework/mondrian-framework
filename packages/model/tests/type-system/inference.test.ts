import m from '../../src'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe } from 'vitest'

describe('Infer', () => {
  test('NumberType inferred as number', () => {
    const model = m.number()
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })

  test('StringType inferred as string', () => {
    const model = m.string()
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<string>()
  })

  test('BooleanType inferred as boolean', () => {
    const model = m.boolean()
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<boolean>()
  })

  test('EnumType inferred as enum', () => {
    const model = m.enumeration(['one', 'two', 'three'])
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<'one' | 'two' | 'three'>()
  })

  describe('LiteralType', () => {
    test('LiteralType of number inferred as literal number', () => {
      const model = m.literal(1)
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<1>()
    })

    test('LiteralType of string inferred as literal string', () => {
      const model = m.literal('mondrian')
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<'mondrian'>()
    })

    test('LiteralType of boolean inferred as literal boolean', () => {
      const model = m.literal(true)
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<true>()
    })

    test('LiteralType of null inferred as literal null', () => {
      const model = m.literal(null)
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<null>()
    })
  })

  describe('ObjectType', () => {
    test('immutable ObjectType inferred with immutable fields', () => {
      const model = m.object({
        field1: m.number(),
        field2: m.string(),
      })
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1: number; readonly field2: string }>()
    })

    test('mutable ObjectType inferred with mutable fields', () => {
      const model = m.mutableObject({
        field1: m.number(),
        field2: m.string(),
      })
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ field1: number; field2: string }>()
    })

    test('merged objects inferred as a single object', () => {
      const model = m.merge('immutable', m.object({ field1: m.string() }), m.object({ field2: m.number() }))
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field1: string; readonly field2: number }>()
    })

    test("second object overrides the first object's fields", () => {
      const model = m.merge('immutable', m.object({ field: m.string() }), m.object({ field: m.number() }))
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<{ readonly field: number }>()
    })
  })

  describe('ArrayType', () => {
    test('immutable ArrayType inferred as readonly array', () => {
      const model = m.array(m.number())
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<readonly number[]>()
    })

    test('mutable ArrayType inferred as array', () => {
      const model = m.mutableArray(m.number())
      type Inferred = m.Infer<typeof model>
      expectTypeOf<Inferred>().toEqualTypeOf<number[]>()
    })
  })

  test('OptionalType inferred as union with undefined', () => {
    const model = m.optional(m.number())
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number | undefined>()
  })

  test('NullableType inferred as union with null', () => {
    const model = m.nullable(m.number())
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number | null>()
  })

  test('Function returning type is inferred as the returned type', () => {
    const model = () => m.number()
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })

  test('ReferenceType inferred as the wrapped type', () => {
    const model = m.reference(m.number())
    type Inferred = m.Infer<typeof model>
    expectTypeOf<Inferred>().toEqualTypeOf<number>()
  })

  test('UnionType inferred as union of types', () => {
    const model = m.union({
      variant1: m.string(),
      variant2: m.object({ field1: m.string(), field2: m.boolean() }),
      variant3: m.boolean(),
    })
    type Inferred = m.Infer<typeof model>

    expectTypeOf<Inferred>().toEqualTypeOf<string | { readonly field1: string; readonly field2: boolean } | boolean>()
  })
})
