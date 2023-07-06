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
