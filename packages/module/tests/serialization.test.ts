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
      types: {
        Input: { string: { type: 'string', options: { name: 'Input' } } },
        Output: { number: { type: 'number', options: { name: 'Output' } } },
        ANONYMOUS_TYPE_0: { custom: { type: 'custom', typeName: 'never' } },
      },
      functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_0' } },
    })
  })

  test('Simple module with custom types', () => {
    const f = functions.define({
      input: types.record(types.dateTime({ maximum: new Date(234), minimum: new Date(123) })).setName('Input'),
      output: types.timestamp({ maximum: new Date(2340), minimum: new Date(1230) }).setName('Output'),
      error: types.never(),
    })
    const m = module.define({
      name: 'test',
      version: '0.0.0',
      functions: { f },
    })
    const schema1 = JSON.parse(JSON.stringify(serialization.serialize(m, {})))
    expect(schema1).toEqual({
      name: 'test',
      version: '0.0.0',
      types: {
        Input: { custom: { type: 'custom', typeName: 'record', options: { name: 'Input' } } },
        Output: { custom: { type: 'custom', typeName: 'timestamp', options: { name: 'Output' } } },
        ANONYMOUS_TYPE_0: { custom: { type: 'custom', typeName: 'never' } },
      },
      functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_0' } },
    })
    const schema2 = JSON.parse(JSON.stringify(serialization.serialize(m)))
    expect(schema2).toEqual({
      name: 'test',
      version: '0.0.0',
      types: {
        ANONYMOUS_TYPE_0: {
          custom: {
            type: 'custom',
            typeName: 'datetime',
            options: {},
            custom: { customOptions: { maximum: 234, minimum: 123 } },
          },
        },
        Input: {
          custom: {
            type: 'custom',
            typeName: 'record',
            options: { name: 'Input' },
            custom: { wrappedType: 'ANONYMOUS_TYPE_0' },
          },
        },
        Output: {
          custom: {
            type: 'custom',
            typeName: 'timestamp',
            options: { name: 'Output' },
            custom: { customOptions: { minimum: 1230, maximum: 2340 } },
          },
        },
        ANONYMOUS_TYPE_1: { custom: { type: 'custom', typeName: 'never' } },
      },
      functions: { f: { input: 'Input', output: 'Output', error: 'ANONYMOUS_TYPE_1' } },
    })
  })

  test('Module with all types', () => {
    const str = types.string({ regex: /asd/ }).setName('String')
    const num = types.number().setName('Number')
    const bool = types.boolean().setName('Bool')
    const lit1 = types.literal(123).setName('Literal1')
    const lit2 = types.literal('123').setName('Literal2')
    const lit3 = types.literal(true).setName('Literal3')
    const lit4 = types.literal(null).setName('Literal4')
    const enumerator = types.enumeration(['A', 'B']).setName('Enum')
    const datetime = types.dateTime().setName('DateTime')
    const timestamp = types.dateTime().setName('Timestamp')
    const record = types.record(types.string()).setName('Record')
    const f = functions.define({
      input: types
        .object({ str, num, bool, lit1, lit2, lit3, lit4, enumerator, datetime, timestamp, record })
        .setName('Input'),
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
        String: { string: { type: 'string', options: { regex: 'asd', name: 'String' } } },
        Number: { number: { type: 'number', options: { name: 'Number' } } },
        Bool: { boolean: { type: 'boolean', options: { name: 'Bool' } } },
        Literal1: { literal: { type: 'literal', literalValue: { number: 123 }, options: { name: 'Literal1' } } },
        Literal2: { literal: { type: 'literal', literalValue: { string: '123' }, options: { name: 'Literal2' } } },
        Literal3: { literal: { type: 'literal', literalValue: { boolean: true }, options: { name: 'Literal3' } } },
        Literal4: { literal: { type: 'literal', literalValue: { null: null }, options: { name: 'Literal4' } } },
        Enum: { enumeration: { type: 'enumeration', variants: ['A', 'B'], options: { name: 'Enum' } } },
        DateTime: {
          custom: {
            type: 'custom',
            typeName: 'datetime',
            options: { name: 'DateTime' },
            custom: { customOptions: {} },
          },
        },
        Timestamp: {
          custom: {
            type: 'custom',
            typeName: 'datetime',
            options: { name: 'Timestamp' },
            custom: { customOptions: {} },
          },
        },
        ANONYMOUS_TYPE_0: { string: { type: 'string' } },
        Record: {
          custom: {
            type: 'custom',
            typeName: 'record',
            options: { name: 'Record' },
            custom: { wrappedType: 'ANONYMOUS_TYPE_0' },
          },
        },
        Input: {
          object: {
            type: 'object',
            fields: {
              str: { type: 'String' },
              num: { type: 'Number' },
              bool: { type: 'Bool' },
              lit1: { type: 'Literal1' },
              lit2: { type: 'Literal2' },
              lit3: { type: 'Literal3' },
              lit4: { type: 'Literal4' },
              enumerator: { type: 'Enum' },
              datetime: { type: 'DateTime' },
              timestamp: { type: 'Timestamp' },
              record: { type: 'Record' },
            },
            options: { name: 'Input' },
          },
        },
        Output: { optional: { type: 'optional', wrappedType: 'String', options: { name: 'Output' } } },
        Error1: { nullable: { type: 'nullable', wrappedType: 'String', options: { name: 'Error1' } } },
        Error2: { array: { type: 'array', wrappedType: 'String', options: { name: 'Error2' } } },
        Error: {
          union: {
            type: 'union',
            variants: { error1: { type: 'Error1' }, error2: { type: 'Error2' } },
            options: { name: 'Error' },
          },
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
        ANONYMOUS_TYPE_0: { string: { type: 'string' } },
        ANONYMOUS_TYPE_1: { optional: { type: 'optional', wrappedType: 'ANONYMOUS_TYPE_0' } },
        ANONYMOUS_TYPE_2: { nullable: { type: 'nullable', wrappedType: 'ANONYMOUS_TYPE_0' } },
        ANONYMOUS_TYPE_3: { array: { type: 'array', wrappedType: 'ANONYMOUS_TYPE_0' } },
        ANONYMOUS_TYPE_4: {
          union: {
            type: 'union',
            variants: { u1: { type: 'ANONYMOUS_TYPE_0' }, u2: { type: 'ANONYMOUS_TYPE_4' } },
            lazy: true,
          },
        },
        Input: {
          object: {
            type: 'object',
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
        ANONYMOUS_TYPE_5: { number: { type: 'number' } },
        Output: {
          object: {
            type: 'object',
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
        Error: { custom: { type: 'custom', typeName: 'never', options: { name: 'Error' } } },
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
        ANONYMOUS_TYPE_0: { string: { type: 'string' } },
        ANONYMOUS_TYPE_1: {
          object: { type: 'object', fields: { s: { type: 'ANONYMOUS_TYPE_0' }, input: { type: 'Input' } }, lazy: true },
        },
        Input: {
          object: {
            type: 'object',
            fields: {
              s: { type: 'ANONYMOUS_TYPE_0' },
              other: { type: 'ANONYMOUS_TYPE_1' },
              other2: { type: 'ANONYMOUS_TYPE_1' },
            },
            options: { name: 'Input' },
            lazy: true,
          },
        },
        Output: { number: { type: 'number', options: { name: 'Output' } } },
        ANONYMOUS_TYPE_2: { custom: { type: 'custom', typeName: 'never' } },
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
      Input: { type: 'literal', literalValue: { null: null }, options: { name: 'Input' } },
      Output: { type: 'literal', literalValue: { string: '123' }, options: { name: 'Output' } },
      ANONYMOUS_TYPE_1: { type: 'literal', literalValue: { number: 123 } },
      ANONYMOUS_TYPE_2: { type: 'literal', literalValue: { boolean: true } },
      ANONYMOUS_TYPE_0: { type: 'custom', typeName: 'never' },
    },
  })
  expect(result1.isOk).toBe(true)
})
