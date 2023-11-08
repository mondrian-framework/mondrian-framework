import { model, decoding, validation } from '../../src'
import { test } from '@fast-check/vitest'
import { expectTypeOf, describe } from 'vitest'

describe('Infer', () => {
  test('NumberType inferred as number', () => {
    const Model = model.number()
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<number>()
  })

  test('StringType inferred as string', () => {
    const Model = model.string()
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<string>()
  })

  test('BooleanType inferred as boolean', () => {
    const Model = model.boolean()
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<boolean>()
  })

  test('DateTimeType inferred as Date', () => {
    const Model = model.datetime()
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<Date>()
  })

  test('TimestampType inferred as Date', () => {
    const Model = model.timestamp()
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<Date>()
  })

  test('UnknownType inferred as unknown', () => {
    const Model = model.unknown()
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<unknown>()
  })

  test('EnumType inferred as enum', () => {
    const Model = model.enumeration(['one', 'two', 'three'])
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<'one' | 'two' | 'three'>()
  })

  describe('LiteralType', () => {
    test('LiteralType of number inferred as literal number', () => {
      const Model = model.literal(1)
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<1>()
    })

    test('LiteralType of string inferred as literal string', () => {
      const Model = model.literal('mondrian')
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<'mondrian'>()
    })

    test('LiteralType of boolean inferred as literal boolean', () => {
      const Model = model.literal(true)
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<true>()
    })

    test('LiteralType of null inferred as literal null', () => {
      const Model = model.literal(null)
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<null>()
    })
  })

  describe('ObjectType', () => {
    test('immutable ObjectType inferred with immutable fields', () => {
      const Model = model.object({
        field1: model.number(),
        field2: model.string(),
        field3: model.object({ inner: model.boolean() }).mutable(),
      })
      type Model = model.Infer<typeof Model>
      type Expected = {
        readonly field1: number
        readonly field2: string
        readonly field3: {
          inner: boolean
        }
      }
      expectTypeOf<Model>().toEqualTypeOf<Expected>()
    })

    test('mutable ObjectType inferred with mutable fields', () => {
      const Model = model.mutableObject({
        field1: model.number(),
        field2: model.string(),
      })
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<{ field1: number; field2: string }>()
    })
  })

  describe('ArrayType', () => {
    test('immutable ArrayType inferred as readonly array', () => {
      const Model = model.array(model.number())
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<readonly number[]>()
    })

    test('mutable ArrayType inferred as array', () => {
      const Model = model.mutableArray(model.number())
      type Model = model.Infer<typeof Model>
      expectTypeOf<Model>().toEqualTypeOf<number[]>()
    })
  })

  test('OptionalType inferred as union with undefined', () => {
    const Model = model.optional(model.number())
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<number | undefined>()
  })

  test('NullableType inferred as union with null', () => {
    const Model = model.nullable(model.number())
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<number | null>()
  })

  test('Function returning type is inferred as the returned type', () => {
    const Model = () => model.object({ field: model.string() })
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<{ readonly field: string }>()
  })

  test('UnionType inferred as union of types', () => {
    const Model = model.union({
      variant1: model.string(),
      variant2: model.object({ field1: model.string(), field2: model.boolean() }),
      variant3: model.boolean(),
    })
    type Model = model.Infer<typeof Model>
    type ModelObject = { readonly field1: string; readonly field2: boolean }
    type Expected = string | ModelObject | boolean
    expectTypeOf<Model>().toEqualTypeOf<Expected>()
  })

  test('CustomType inferred as the specified type', () => {
    const Model = model.custom<'myCustomType', {}, number>(
      'myCustomType',
      () => null,
      () => decoding.fail('test', 'test'),
      () => validation.fail('test', 'test'),
      () => {
        throw 'error'
      },
    )
    type Model = model.Infer<typeof Model>
    expectTypeOf<Model>().toEqualTypeOf<number>()
  })
})
