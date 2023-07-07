import m from '../src'
import {
  arrayOptions,
  baseOptions,
  nonEmptyArray,
  numberGenerator,
  stringGenerator,
  stringOptions,
  numberOptions,
} from './generator-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { expect, expectTypeOf, describe } from 'vitest'

describe('NumberType', () => {
  test('a NumberType is inferred to be a number', () => {
    type Age = m.Infer<typeof age>
    const age = m.number()
    expectTypeOf<Age>().toEqualTypeOf<number>()
  })

  test.prop([numberOptions()])('the number function generates a NumberType with the provided options', (opts) => {
    const n = m.number(opts)
    expect(n.opts).toBe(opts)
  })

  test.prop([numberOptions()])(
    'the integer function generates a NumberType with multipleOf set to an integer',
    (opts) => {
      const n = m.integer(opts)
      opts?.multipleOf ? expect(n.opts).toEqual(opts) : expect(n.opts).toEqual({ ...opts, multipleOf: 1 })
    },
  )
})

describe('StringType', () => {
  test('a StringType is inferred to be a string', () => {
    type Username = m.Infer<typeof username>
    const username = m.string()
    expectTypeOf<Username>().toEqualTypeOf<string>()
  })

  test.prop([stringOptions()])('the string function generates a StringType with the given options', (opts) => {
    const s = m.string(opts)
    expect(s.opts).toBe(opts)
  })
})

describe('BooleanType', () => {
  test('a BooleanType is inferred to be a boolean', () => {
    type AdminFlag = m.Infer<typeof adminFlag>
    const adminFlag = m.boolean()
    expectTypeOf<AdminFlag>().toEqualTypeOf<boolean>()
  })

  test.prop([baseOptions()])('the boolean function generates a BooleanType with the given options', (opts) => {
    const b = m.boolean(opts)
    expect(b.opts).toBe(opts)
  })
})

describe('LiteralType', () => {
  test('a LiteralType with a string literal is inferred to be the corresponding string literal', () => {
    type Literal = m.Infer<typeof literal>
    const literal = m.literal('literal')
    expectTypeOf<Literal>().toEqualTypeOf<'literal'>()
  })

  test('a LiteralType with a number literal is inferred to be the corresponding number literal', () => {
    type Literal = m.Infer<typeof literal>
    const literal = m.literal(1)
    expectTypeOf<Literal>().toEqualTypeOf<1>()
  })

  test('a LiteralType with a boolean literal is inferred to be the corresponding boolean literal', () => {
    type LiteralTrue = m.Infer<typeof literalTrue>
    const literalTrue = m.literal(true)
    expectTypeOf<LiteralTrue>().toEqualTypeOf<true>()

    type LiteralFalse = m.Infer<typeof literalFalse>
    const literalFalse = m.literal(false)
    expectTypeOf<LiteralFalse>().toEqualTypeOf<false>()
  })

  test('a LiteralType with a null literal is inferred to be the null literal', () => {
    type Literal = m.Infer<typeof literal>
    const literal = m.literal(null)
    expectTypeOf<Literal>().toEqualTypeOf<null>()
  })
})

describe('ObjectType', () => {
  test('an ObjectType is inferred to be an object with the corresponding fields', () => {
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

  test.prop([baseOptions()])('the object function generates an object with the given fields and methods', (opts) => {
    const fields = { name: m.string(), age: m.integer() }
    const o = m.object(fields, opts)
    expect(o.opts).toBe(opts)
    expect(o.type).toBe(fields)
  })
})

describe('EnumerationType', () => {
  test('an EnumerationType is inferred to be a union of literal strings', () => {
    type TestEnum = m.Infer<typeof testEnum>
    const testEnum = m.enum(['type1', 'type2', 'type3'])
    expectTypeOf<TestEnum>().toEqualTypeOf<'type1' | 'type2' | 'type3'>()
  })

  test('an EnumerationType with a single case is inferred to be a literal string', () => {
    type TestEnum = m.Infer<typeof testEnum>
    const testEnum = m.enum(['type'])
    expectTypeOf<TestEnum>().toEqualTypeOf<'type'>()
  })

  test.prop([nonEmptyArray(gen.string()), baseOptions()])(
    'the enum function generates an EnumerationType with the given fields',
    (strings, opts) => {
      const testEnum = m.enum(strings, opts)
      expect(testEnum.values).toBe(strings)
      expect(testEnum.opts).toBe(opts)
    },
  )
})

describe('ArrayDecorator', () => {
  test('ArrayDecorator can turn a type into an array of that type', () => {
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

  test.prop([baseOptions(), stringGenerator()])(
    'the array function creates an array with the provided type and options',
    (opts, string) => {
      const a = m.array(string, opts)
      expect(a.opts).toBe(opts)
      expect(a.type).toBe(string)
    },
  )

  test.prop([stringGenerator(), arrayOptions()])(
    'the array function and array decorator are equivalent',
    (string, opts) => {
      type One = m.Infer<typeof one>
      type Other = m.Infer<typeof other>
      const one = m.array(string, opts)
      const other = string.array(opts)

      expectTypeOf<One>().toEqualTypeOf<Other>()
      expect(other.type.kind).toBe(one.type.kind)
      expect(one.type.opts).toBe(other.type.opts)
    },
  )
})

describe('OptionalDecorator', () => {
  test('OptionalDecorator can turn a type into an optional version', () => {
    type OptionalString = m.Infer<typeof optionalString>
    const optionalString = m.string().optional()
    expectTypeOf<OptionalString>().toEqualTypeOf<undefined | string>()
  })

  test('OptionalDecorator is idempotent with regard to type inference', () => {
    type One = m.Infer<typeof one>
    type Other = m.Infer<typeof other>
    const one = m.optional(m.optional(m.string()))
    const other = m.optional(m.string())
    expectTypeOf<One>().toEqualTypeOf<Other>()
  })

  test.prop([stringGenerator(), baseOptions()])(
    'the optional function and optional decorator are equivalent',
    (string, opts) => {
      type One = m.Infer<typeof one>
      type Other = m.Infer<typeof other>
      const one = string.optional(opts)
      const other = m.optional(string, opts)

      expectTypeOf<One>().toEqualTypeOf<Other>()
      expect(one.opts).toBe(opts)
      expect(other.opts).toBe(opts)
      // Check the wrapped strings are the same
      expect(one.type.opts).toBe(string.opts)
      expect(other.type.opts).toBe(string.opts)
      expect(one.type.kind).toBe(string.kind)
      expect(other.type.kind).toBe(string.kind)
    },
  )
})

describe('NullableDecorator', () => {
  test('NullableDecorator can turn a type into a nullable version', () => {
    type NullableString = m.Infer<typeof nullableString>
    const nullableString = m.string().nullable()
    expectTypeOf<NullableString>().toEqualTypeOf<null | string>()
  })

  test('NullableDecorator is idempotent with regard to type inference', () => {
    type One = m.Infer<typeof one>
    type Other = m.Infer<typeof other>
    const one = m.nullable(m.nullable(m.string()))
    const other = m.nullable(m.string())
    expectTypeOf<One>().toEqualTypeOf<Other>()
  })

  test.prop([stringGenerator(), baseOptions()])(
    'the nullable function and decorator are equivalent',
    (string, opts) => {
      type One = m.Infer<typeof one>
      type Other = m.Infer<typeof other>
      const one = m.nullable(string, opts)
      const other = string.nullable(opts)

      expectTypeOf<One>().toEqualTypeOf<Other>()
      expect(one.opts).toBe(opts)
      expect(other.opts).toBe(opts)
      // Check the wrapped strings are the same
      expect(one.type.opts).toBe(string.opts)
      expect(other.type.opts).toBe(string.opts)
      expect(one.type.kind).toBe(string.kind)
      expect(other.type.kind).toBe(string.kind)
    },
  )
})

describe('DefaultDecorator', () => {
  test('DefaultDecorator does not change the inferred type', () => {
    type One = m.Infer<typeof one>
    type Other = m.Infer<typeof other>
    const one = m.string()
    const other = m.string().default('Hello, Mondrian!')
    expectTypeOf<One>().toEqualTypeOf<Other>()
  })

  test.prop([numberGenerator(), gen.integer(), baseOptions()])(
    'the default function adds the provided default to a type',
    (number, defaultValue, opts) => {
      const defaultNumber = m.default(number, defaultValue, opts)
      expect(defaultNumber.defaultValue).toEqual(defaultValue)
    },
  )

  test.prop([numberGenerator(), gen.integer(), baseOptions()])(
    'the default function and the default method are equivalent',
    (number, defaultValue, opts) => {
      type One = m.Infer<typeof one>
      type Other = m.Infer<typeof other>
      const one = m.default(number, defaultValue, opts)
      const other = number.default(defaultValue, opts)

      expectTypeOf<One>().toEqualTypeOf<Other>()
      expect(one.defaultValue).toBe(other.defaultValue)
      expect(one.opts).toBe(opts)
      expect(other.opts).toBe(opts)
      // Check the wrapped numbers are the same
      expect(one.type.opts).toBe(number.opts)
      expect(other.type.opts).toBe(number.opts)
      expect(one.type.kind).toBe(number.kind)
      expect(other.type.kind).toBe(number.kind)
    },
  )
})
