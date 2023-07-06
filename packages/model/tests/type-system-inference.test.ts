import m from '../src'
import { nonEmptyArray } from './generator-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { expect, expectTypeOf, describe } from 'vitest'

describe('number', () => {
  test('number type is inferred to be a number', () => {
    type Age = m.Infer<typeof age>
    const age = m.number()
    expectTypeOf<Age>().toEqualTypeOf<number>()
  })
})

describe('string', () => {
  test('string type is inferred to be a string', () => {
    type Username = m.Infer<typeof username>
    const username = m.string()
    expectTypeOf<Username>().toEqualTypeOf<string>()
  })
})

describe('boolean', () => {
  test('boolean type is inferred to be a boolean', () => {
    type AdminFlag = m.Infer<typeof adminFlag>
    const adminFlag = m.boolean()
    expectTypeOf<AdminFlag>().toEqualTypeOf<boolean>()
  })
})

describe('literal', () => {
  test('string literal is inferred to be the corresponding string literal', () => {
    type Literal = m.Infer<typeof literal>
    const literal = m.literal('literal')
    expectTypeOf<Literal>().toEqualTypeOf<'literal'>()
  })

  test('number literal is inferred to be the corresponding number literal', () => {
    type Literal = m.Infer<typeof literal>
    const literal = m.literal(1)
    expectTypeOf<Literal>().toEqualTypeOf<1>()
  })

  test('boolean literal is inferred to be the corresponding boolean literal', () => {
    type LiteralTrue = m.Infer<typeof literalTrue>
    const literalTrue = m.literal(true)
    expectTypeOf<LiteralTrue>().toEqualTypeOf<true>()

    type LiteralFalse = m.Infer<typeof literalFalse>
    const literalFalse = m.literal(false)
    expectTypeOf<LiteralFalse>().toEqualTypeOf<false>()
  })

  test('null literal is inferred to be the null literal', () => {
    type Literal = m.Infer<typeof literal>
    const literal = m.literal(null)
    expectTypeOf<Literal>().toEqualTypeOf<null>()
  })
})

describe('object', () => {
  test('an object type is inferred to be an object with the corresponding fields', () => {
    type User = m.Infer<typeof user>
    const user = m.object(
      {
        name: m.string(),
        age: m.number(),
        isAdmin: m.boolean(),
      },
      {
        name: 'user',
        description: 'a user',
      },
    )
    expectTypeOf<User>().toEqualTypeOf<{ name: string; age: number; isAdmin: boolean }>()
  })

  test('type inference works on nested objects', () => {
    type Nested = m.Infer<typeof nested>
    const nested = m.object({
      field: m.object({
        name: m.string(),
      }),
    })
    expectTypeOf<Nested>().toEqualTypeOf<{ field: { name: string } }>()
  })
})

describe('enumeration', () => {
  test('enum type is inferred to be a union of literal strings', () => {
    type TestEnum = m.Infer<typeof testEnum>
    const testEnum = m.enum(['type1', 'type2', 'type3'])
    expectTypeOf<TestEnum>().toEqualTypeOf<'type1' | 'type2' | 'type3'>()
  })

  test('enum type with a single case is inferred to be a literal string', () => {
    type TestEnum = m.Infer<typeof testEnum>
    const testEnum = m.enum(['type'])
    expectTypeOf<TestEnum>().toEqualTypeOf<'type'>()
  })

  test.prop([nonEmptyArray(gen.string())])(
    'enum function generates an enumeration with the given fields',
    (strings) => {
      const testEnum = m.enum(strings)
      expect(testEnum.values).toEqual(strings)
    },
  )
})

describe('array', () => {
  test('the array decorator can turn a type into an array of that type', () => {
    type StringArray = m.Infer<typeof stringArray>
    const stringArray = m.string().array({
      name: 'a list of at most 3 strings',
      maxItems: 3,
    })
    expectTypeOf<StringArray>().toEqualTypeOf<string[]>()
  })

  test('type inference works on nested arrays', () => {
    type Grid = m.Infer<typeof grid>
    const grid = m.number().array().array()
    expectTypeOf<Grid>().toEqualTypeOf<number[][]>()
  })
})

describe('optional', () => {
  test('the optional decorator can turn a type into an optional version', () => {
    type OptionalString = m.Infer<typeof optionalString>
    const optionalString = m.string().optional()
    expectTypeOf<OptionalString>().toEqualTypeOf<undefined | string>()
  })

  test('the optional decorator is idempotent with regard to type inference', () => {
    type One = m.Infer<typeof one>
    type Other = m.Infer<typeof other>
    const one = m.optional(m.optional(m.string()))
    const other = m.optional(m.string())
    expectTypeOf<One>().toEqualTypeOf<Other>()
  })
})

describe('nullable', () => {
  test('the nullable decorator can turn a type into a nullable version', () => {
    type NullableString = m.Infer<typeof nullableString>
    const nullableString = m.string().nullable()
    expectTypeOf<NullableString>().toEqualTypeOf<null | string>()
  })

  test('the nullable decorator is idempotent with regard to type inference', () => {
    type One = m.Infer<typeof one>
    type Other = m.Infer<typeof other>
    const one = m.nullable(m.nullable(m.string()))
    const other = m.nullable(m.string())
    expectTypeOf<One>().toEqualTypeOf<Other>()
  })
})
