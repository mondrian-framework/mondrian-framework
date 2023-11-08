import { functions, module, serialization } from '../src'
import { result, types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('Module interface to schema', () => {
  test('Simple module', () => {
    const f = functions.define({
      input: types.string().setName('Input'),
      output: types.number().setName('Output'),
      errors: undefined,
      retrieve: undefined,
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
        Input: { type: 'string', options: { name: 'Input' } },
        Output: { type: 'number', options: { name: 'Output' } },
      },
      functions: { f: { input: 'Input', output: 'Output' } },
    })
  })

  test('Simple module with custom types', () => {
    const f = functions.define({
      input: types.record(types.datetime({ maximum: new Date(234), minimum: new Date(123) })).setName('Input'),
      output: types.timestamp({ maximum: new Date(2340), minimum: new Date(1230) }).setName('Output'),
      errors: undefined,
      retrieve: undefined,
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
        Input: { type: 'custom', typeName: 'record', options: { name: 'Input' } },
        Output: { type: 'custom', typeName: 'timestamp', options: { name: 'Output' } },
      },
      functions: { f: { input: 'Input', output: 'Output' } },
    })
    const schema2 = JSON.parse(JSON.stringify(serialization.serialize(m)))
    expect(schema2).toEqual({
      name: 'test',
      version: '0.0.0',
      types: {
        ANONYMOUS_TYPE_0: {
          type: 'custom',
          typeName: 'datetime',
          options: {},
          custom: { customOptions: { minimum: 123, maximum: 234 } },
        },
        Input: {
          type: 'custom',
          typeName: 'record',
          options: { name: 'Input' },
          custom: { wrappedType: 'ANONYMOUS_TYPE_0' },
        },
        Output: {
          type: 'custom',
          typeName: 'timestamp',
          options: { name: 'Output' },
          custom: { customOptions: { minimum: 1230, maximum: 2340 } },
        },
      },
      functions: { f: { input: 'Input', output: 'Output' } },
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
    const datetime = types.datetime().setName('DateTime')
    const timestamp = types.datetime().setName('Timestamp')
    const record = types.record(types.string()).setName('Record')
    const f = functions.define({
      input: types
        .object({ str, num, bool, lit1, lit2, lit3, lit4, enumerator, datetime, timestamp, record })
        .setName('Input'),
      output: str.optional().setName('Output'),
      errors: { error1: str.nullable().setName('Error1'), error2: str.array().setName('Error2') },
      retrieve: { orderBy: true, select: true, skip: true, take: true, where: true },
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
        String: { type: 'string', options: { regex: 'asd', name: 'String' } },
        Number: { type: 'number', options: { name: 'Number' } },
        Bool: { type: 'boolean', options: { name: 'Bool' } },
        Literal1: { type: 'literal', literalValue: 123, options: { name: 'Literal1' } },
        Literal2: { type: 'literal', literalValue: '123', options: { name: 'Literal2' } },
        Literal3: { type: 'literal', literalValue: true, options: { name: 'Literal3' } },
        Literal4: { type: 'literal', literalValue: null, options: { name: 'Literal4' } },
        Enum: { type: 'enumeration', variants: ['A', 'B'], options: { name: 'Enum' } },
        DateTime: {
          type: 'custom',
          typeName: 'datetime',
          options: { name: 'DateTime' },
          custom: { customOptions: {} },
        },
        Timestamp: {
          type: 'custom',
          typeName: 'datetime',
          options: { name: 'Timestamp' },
          custom: { customOptions: {} },
        },
        ANONYMOUS_TYPE_0: { type: 'string' },
        Record: {
          type: 'custom',
          typeName: 'record',
          options: { name: 'Record' },
          custom: { wrappedType: 'ANONYMOUS_TYPE_0' },
        },
        Input: {
          type: 'object',
          fields: {
            str: 'String',
            num: 'Number',
            bool: 'Bool',
            lit1: 'Literal1',
            lit2: 'Literal2',
            lit3: 'Literal3',
            lit4: 'Literal4',
            enumerator: 'Enum',
            datetime: 'DateTime',
            timestamp: 'Timestamp',
            record: 'Record',
          },
          options: { name: 'Input' },
        },
        Output: { type: 'optional', wrappedType: 'String', options: { name: 'Output' } },
        Error1: { type: 'nullable', wrappedType: 'String', options: { name: 'Error1' } },
        Error2: { type: 'array', wrappedType: 'String', options: { name: 'Error2' } },
      },
      functions: { f: { input: 'Input', output: 'Output', errors: { error1: 'Error1', error2: 'Error2' } } },
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
            t6: union,
          })
          .setName('Input'),
      output: types
        .object({
          t1: types.string(),
          t2: types.string().optional(),
          t3: types.string().nullable(),
          t4: types.string().array(),
          t6: union,
        })
        .setName('Output'),
      errors: {},
      retrieve: undefined,
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
        ANONYMOUS_TYPE_0: { type: 'string' },
        ANONYMOUS_TYPE_1: { type: 'optional', wrappedType: 'ANONYMOUS_TYPE_0' },
        ANONYMOUS_TYPE_2: { type: 'nullable', wrappedType: 'ANONYMOUS_TYPE_0' },
        ANONYMOUS_TYPE_3: { type: 'array', wrappedType: 'ANONYMOUS_TYPE_0' },
        ANONYMOUS_TYPE_4: {
          type: 'union',
          variants: { u1: { type: 'ANONYMOUS_TYPE_0' }, u2: { type: 'ANONYMOUS_TYPE_4' } },
          lazy: true,
        },
        Input: {
          type: 'object',
          fields: {
            t1: 'ANONYMOUS_TYPE_0',
            t2: 'ANONYMOUS_TYPE_1',
            t3: 'ANONYMOUS_TYPE_2',
            t4: 'ANONYMOUS_TYPE_3',
            t6: 'ANONYMOUS_TYPE_4',
          },
          options: { name: 'Input' },
          lazy: true,
        },
        Output: {
          type: 'object',
          fields: {
            t1: 'ANONYMOUS_TYPE_0',
            t2: 'ANONYMOUS_TYPE_1',
            t3: 'ANONYMOUS_TYPE_2',
            t4: 'ANONYMOUS_TYPE_3',
            t6: 'ANONYMOUS_TYPE_4',
          },
          options: { name: 'Output' },
        },
      },
      functions: { f: { input: 'Input', output: 'Output', errors: {} } },
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
      errors: undefined,
      retrieve: undefined,
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
        ANONYMOUS_TYPE_0: { type: 'string' },
        ANONYMOUS_TYPE_1: { type: 'object', fields: { s: 'ANONYMOUS_TYPE_0', input: 'Input' }, lazy: true },
        Input: {
          type: 'object',
          fields: { s: 'ANONYMOUS_TYPE_0', other: 'ANONYMOUS_TYPE_1', other2: 'ANONYMOUS_TYPE_1' },
          options: { name: 'Input' },
          lazy: true,
        },
        Output: { type: 'number', options: { name: 'Output' } },
      },
      functions: { f: { input: 'Input', output: 'Output' } },
    })
  })
})

test('Decode schema', () => {
  const result1 = serialization.moduleSchema.decode({
    name: 'test',
    version: '0.0.0',
    types: {
      ANONYMOUS_TYPE_0: { type: 'string' },
      ANONYMOUS_TYPE_1: { type: 'object', fields: { s: 'ANONYMOUS_TYPE_0', input: 'Input' }, lazy: true },
      Input: {
        type: 'object',
        fields: { s: 'ANONYMOUS_TYPE_0', other: 'ANONYMOUS_TYPE_1', other2: 'ANONYMOUS_TYPE_1' },
        options: { name: 'Input' },
        lazy: true,
      },
      Output: { type: 'number', options: { name: 'Output' } },
    },
    functions: { f: { input: 'Input', output: 'Output' } },
  })
  expect(result1.isOk).toBe(true)
})
