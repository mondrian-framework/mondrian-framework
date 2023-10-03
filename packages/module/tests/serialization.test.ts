import { functions, module, serialization } from '../src'
import { result, types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('Module interface to schema', () => {
  test('Simple module', () => {
    const f = functions.define({
      input: types.string().setName('Input'),
      output: types.number().setName('Output'),
      error: types.never(),
    })
    const m = module.define({
      name: 'test',
      version: '0.0.0',
      functions: { f },
    })
    const schema = JSON.parse(JSON.stringify(serialization.serialize(m)))
    expect(schema).toEqual({
      name: 'test',
      version: '0.0.0',
      functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_0' } },
      types: {
        Input: { string: { options: { name: 'Input' } } },
        Output: { number: { options: { name: 'Output' } } },
        ANONYMOUS_TYPE_0: { custom: { typeName: 'never' } },
      },
    })
  })

  test('Module with all types', () => {
    const str = types.string({ regex: /asd/ }).setName('String')
    const num = types.number().setName('Number')
    const bool = types.boolean().setName('Bool')
    const lit = types.literal(123).setName('Literal')
    const enumerator = types.enumeration(['A', 'B']).setName('Enum')
    const datetime = types.dateTime().setName('DateTime')
    const f = functions.define({
      input: types.object({ str, num, bool, lit, enumerator, datetime }).setName('Input'),
      output: str.optional().setName('Output'),
      error: types
        .union({ error1: str.nullable().setName('Error1'), error2: str.array().setName('Error2') })
        .setName('Error'),
    })
    const m = module.define({
      name: 'test',
      version: '0.0.0',
      functions: { f },
    })
    const schema = JSON.parse(JSON.stringify(serialization.serialize(m)))
    expect(schema).toEqual({
      name: 'test',
      version: '0.0.0',
      types: {
        String: { string: { options: { regex: 'asd', name: 'String' } } },
        Number: { number: { options: { name: 'Number' } } },
        Bool: { boolean: { options: { name: 'Bool' } } },
        Literal: { literal: { literalValue: 123, options: { name: 'Literal' } } },
        Enum: { enumerator: { variants: ['A', 'B'], options: { name: 'Enum' } } },
        DateTime: { custom: { typeName: 'datetime', options: { name: 'DateTime' } } },
        Input: {
          object: {
            fields: {
              str: { type: 'String' },
              num: { type: 'Number' },
              bool: { type: 'Bool' },
              lit: { type: 'Literal' },
              enumerator: { type: 'Enum' },
              datetime: { type: 'DateTime' },
            },
            options: { name: 'Input' },
          },
        },
        Output: { optional: { wrappedType: 'String', options: { name: 'Output' } } },
        Error1: { nullable: { wrappedType: 'String', options: { name: 'Error1' } } },
        Error2: { array: { wrappedType: 'String', options: { name: 'Error2' } } },
        Error: {
          union: { variants: { error1: { type: 'Error1' }, error2: { type: 'Error2' } }, options: { name: 'Error' } },
        },
      },
      functions: { f: { input: 'Input', output: 'Output', error: 'Error' } },
    })
  })

  test('No duplicate types', () => {
    const union = () => types.union({ u1: types.string(), u2: types.number() })
    const f = functions.define({
      input: () =>
        types
          .object({
            t1: types.string(),
            t2: types.string().optional(),
            t3: types.string().nullable(),
            t4: types.string().array(),
            t5: { virtual: types.string() },
            t6: union,
          })
          .setName('Input'),
      output: types
        .object({
          t1: types.string(),
          t2: types.string().optional(),
          t3: types.string().nullable(),
          t4: types.string().array(),
          t5: { virtual: types.string() },
          t6: union,
        })
        .setName('Output'),
      error: types.never().setName('Error'),
    })
    const m = module.define({
      name: 'test',
      version: '0.0.0',
      functions: { f },
    })
    const schema = JSON.parse(JSON.stringify(serialization.serialize(m)))
    expect(schema).toEqual({
      name: 'test',
      version: '0.0.0',
      types: {
        ANONYMOUS_TYPE_0: { string: {} },
        ANONYMOUS_TYPE_1: { optional: { wrappedType: 'ANONYMOUS_TYPE_0' } },
        ANONYMOUS_TYPE_2: { nullable: { wrappedType: 'ANONYMOUS_TYPE_0' } },
        ANONYMOUS_TYPE_3: { array: { wrappedType: 'ANONYMOUS_TYPE_0' } },
        ANONYMOUS_TYPE_4: {
          union: { variants: { u1: { type: 'ANONYMOUS_TYPE_0' }, u2: { type: 'ANONYMOUS_TYPE_4' } }, lazy: true },
        },
        Input: {
          object: {
            fields: {
              t1: { type: 'ANONYMOUS_TYPE_0' },
              t2: { type: 'ANONYMOUS_TYPE_1' },
              t3: { type: 'ANONYMOUS_TYPE_2' },
              t4: { type: 'ANONYMOUS_TYPE_3' },
              t5: { type: 'ANONYMOUS_TYPE_0', virtual: true },
              t6: { type: 'ANONYMOUS_TYPE_4' },
            },
            options: { name: 'Input' },
            lazy: true,
          },
        },
        ANONYMOUS_TYPE_5: { number: {} },
        Output: {
          object: {
            fields: {
              t1: { type: 'ANONYMOUS_TYPE_0' },
              t2: { type: 'ANONYMOUS_TYPE_1' },
              t3: { type: 'ANONYMOUS_TYPE_2' },
              t4: { type: 'ANONYMOUS_TYPE_3' },
              t5: { type: 'ANONYMOUS_TYPE_0', virtual: true },
              t6: { type: 'ANONYMOUS_TYPE_4' },
            },
            options: { name: 'Output' },
          },
        },
        Error: { custom: { typeName: 'never', options: { name: 'Error' } } },
      },
      functions: { f: { input: 'Input', output: 'Output', error: 'Error' } },
    })
  })

  test('Recursive type', () => {
    const input = () =>
      types
        .object({
          s: types.string(),
          other,
          other2,
        })
        .setName('Input')
    const other = () =>
      types.object({
        s: types.string(),
        input,
      })

    const other2 = () =>
      types.object({
        s: types.string(),
        input,
      })

    const f = functions.define({
      input: input,
      output: types.number().setName('Output'),
      error: types.never(),
    })
    const m = module.define({
      name: 'test',
      version: '0.0.0',
      functions: { f },
    })
    const schema = JSON.parse(JSON.stringify(serialization.serialize(m)))
    expect(schema).toEqual({
      name: 'test',
      version: '0.0.0',
      types: {
        ANONYMOUS_TYPE_0: { string: {} },
        ANONYMOUS_TYPE_1: {
          object: { fields: { s: { type: 'ANONYMOUS_TYPE_0' }, input: { type: 'Input' } }, lazy: true },
        },
        Input: {
          object: {
            fields: {
              s: { type: 'ANONYMOUS_TYPE_0' },
              other: { type: 'ANONYMOUS_TYPE_1' },
              other2: { type: 'ANONYMOUS_TYPE_1' },
            },
            options: { name: 'Input' },
            lazy: true,
          },
        },
        Output: { number: { options: { name: 'Output' } } },
        ANONYMOUS_TYPE_2: { custom: { typeName: 'never' } },
      },
      functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_2' } },
    })
  })
})

test('Decode schema', () => {
  const result1 = serialization.moduleSchema.decode({
    name: 'test',
    version: '0.0.0',
    functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_0' } },
    types: {
      Input: { literal: { literalValue: null, options: { name: 'Input' } } },
      Output: { literal: { literalValue: '123', options: { name: 'Output' } } },
      ANONYMOUS_TYPE_1: { literal: { literalValue: 123 } },
      ANONYMOUS_TYPE_2: { literal: { literalValue: true } },
      ANONYMOUS_TYPE_0: { custom: { typeName: 'never' } },
    },
  })
  expect(result1.isOk).toBe(true)

  const result2 = serialization.moduleSchema.decode({
    name: 'test',
    version: '0.0.0',
    functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_0' } },
    types: {
      Input: { literal: { literalValue: {}, options: { name: 'Input' } } },
      Output: { literal: { literalValue: '123', options: { name: 'Output' } } },
      ANONYMOUS_TYPE_1: { literal: { literalValue: 123 } },
      ANONYMOUS_TYPE_2: { literal: { literalValue: true } },
      ANONYMOUS_TYPE_0: { custom: { typeName: 'never' } },
    },
  })
  expect(result2.isOk).toBe(false)
  expect(!result2.isOk && result2.error[0].got).toEqual({})
  expect(!result2.isOk && 'expected' in result2.error[0] && result2.error[0].expected).toEqual(
    'string, number, boolean or null',
  )
  expect(!result2.isOk && result2.error[0].path.format()).toEqual('$.types.Input.literal.literalValue')
})
