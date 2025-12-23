import {
  assertApiValidity,
  completeRetrieve,
  decodeQueryObject,
  encodeQueryObject,
  getPathsFromSpecification,
  methodFromOptions,
  completeRetrieveInternal,
} from '../src/utils'
import { model } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('completeRetrieve', () => {
  const user = () =>
    model.entity({
      name: model.string(),
      tags: model.string().array(),
      friend: model.optional(user),
      _asd: model.string(),
    })
  test('works with empty retrieve', async () => {
    const p = completeRetrieve({}, user)
    expect(p).toEqual({ select: { name: true, tags: true } })
  })
  test('Add all non virtual fields to projection recursively', async () => {
    const p = completeRetrieve({ select: { friend: { select: { friend: true } } } }, user)
    expect(p).toEqual({
      select: {
        name: true,
        tags: true,
        friend: { select: { name: true, tags: true, friend: true } },
      },
    })
  })

  test('Avoid adding filter multiple times', async () => {
    const p = completeRetrieve(
      { select: { friend: { select: { friend: true }, where: { name: { equals: 'asd' } } } } },
      user,
    )
    expect(p).toEqual({
      select: {
        name: true,
        tags: true,
        friend: {
          select: { name: true, tags: true, friend: true },
          where: { name: { equals: 'asd' } },
        },
      },
    })
  })

  test('Handle in filter correctly', async () => {
    const p = completeRetrieve(
      { select: { friend: { select: { friend: true }, where: { name: { in: ['asd'] } } } } },
      user,
    )
    expect(p).toEqual({
      select: {
        name: true,
        tags: true,
        friend: {
          select: { name: true, tags: true, friend: true },
          where: { name: { in: ['asd'] } },
        },
      },
    })
  })

  test('returns undefined for undefined retrieve', async () => {
    const p = completeRetrieve(undefined, user)
    expect(p).toBeUndefined()
  })

  test('works with scalar type', async () => {
    const p = completeRetrieve({ select: {} }, model.string())
    expect(p).toEqual({ select: {} })
  })

  test('handles wrapped types (optional/nullable/array)', async () => {
    const wrappedUser = model.optional(user)
    const p = completeRetrieve({ select: {} }, wrappedUser)
    expect(p).toEqual({ select: { name: true, tags: true } })
  })

  test('handles array of entities', async () => {
    const userArray = model.array(user)
    const p = completeRetrieve({ select: {} }, userArray)
    expect(p).toEqual({ select: { name: true, tags: true } })
  })
})

describe('completeRetrieveInternal', () => {
  test('returns undefined for undefined retrieve', () => {
    const result = completeRetrieveInternal(undefined, model.string())
    expect(result).toBeUndefined()
  })
})

describe('assertApiValidity', () => {
  test('accepts valid api configuration', () => {
    assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get' } } })
    expect(true).toBe(true)
  })

  test('throws on min version out of bounds', () => {
    expect(() =>
      assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', version: { min: 2 } } } }),
    ).toThrowError("Invalid version for function f1. 'min' must be between 1 and 1 and be an integer")
  })

  test('throws on non-integer min version', () => {
    expect(() =>
      assertApiValidity({
        module: null as any,
        version: 3,
        functions: { f1: { method: 'get', version: { min: 2.2 } } },
      }),
    ).toThrowError("Invalid version for function f1. 'min' must be between 1 and 3 and be an integer")
  })

  test('throws on non-integer max version', () => {
    expect(() =>
      assertApiValidity({
        module: null as any,
        version: 3,
        functions: { f1: { method: 'get', version: { max: 2.2 } } },
      }),
    ).toThrowError("Invalid version for function f1. 'max' must be between 1 and 3 and be an integer")
  })

  test('throws on max version out of bounds', () => {
    expect(() =>
      assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', version: { max: 2 } } } }),
    ).toThrowError("Invalid version for function f1. 'max' must be between 1 and 1 and be an integer")
  })

  test('throws on min greater than max', () => {
    expect(() =>
      assertApiValidity({
        module: null as any,
        version: 10,
        functions: { f1: { method: 'get', version: { max: 2, min: 3 } } },
      }),
    ).toThrowError("Invalid version for function f1. 'min' must be less than or equals to 'max'")
  })

  test('throws on non-integer api version', () => {
    expect(() =>
      assertApiValidity({ module: null as any, version: 1.5, functions: { f1: { method: 'get' } } }),
    ).toThrowError('Invalid api version. Must be between 1 and 100 and be an integer. Got 1.5')
  })

  test('throws on negative api version', () => {
    expect(() =>
      assertApiValidity({ module: null as any, version: -1, functions: { f1: { method: 'get' } } }),
    ).toThrowError('Invalid api version. Must be between 1 and 100 and be an integer. Got -1')
  })

  test('throws on api version greater than 100', () => {
    expect(() =>
      assertApiValidity({ module: null as any, version: 101, functions: { f1: { method: 'get' } } }),
    ).toThrowError('Invalid api version. Must be between 1 and 100 and be an integer. Got 101')
  })

  test('throws on path not starting with /', () => {
    expect(() =>
      assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', path: 'invalid' } } }),
    ).toThrowError("Invalid path for function f1. Path must start with a '/'. Got invalid")
  })

  test('accepts valid path starting with /', () => {
    assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', path: '/valid' } } })
    expect(true).toBe(true)
  })

  test('accepts array of specifications', () => {
    assertApiValidity({
      module: null as any,
      version: 3,
      functions: {
        f1: [
          { method: 'get', version: { min: 1, max: 2 } },
          { method: 'post', version: { min: 3, max: 3 } },
        ],
      },
    })
    expect(true).toBe(true)
  })

  test('throws on invalid version in array of specifications', () => {
    expect(() =>
      assertApiValidity({
        module: null as any,
        version: 3,
        functions: {
          f1: [
            { method: 'get', version: { min: 1, max: 2 } },
            { method: 'post', version: { min: 5 } },
          ],
        },
      }),
    ).toThrowError("Invalid version for function f1. 'min' must be between 1 and 3 and be an integer")
  })
})

describe('getPathsFromSpecification', () => {
  test('generates paths for all versions', () => {
    const r1 = getPathsFromSpecification({
      functionName: 'f',
      maxVersion: 3,
      prefix: '/api',
      specification: { method: 'get' },
    })
    expect(r1).toEqual(['/api/v1/f', '/api/v2/f', '/api/v3/f'])
  })

  test('generates paths for specific version range', () => {
    const r2 = getPathsFromSpecification({
      functionName: 'f',
      maxVersion: 3,
      prefix: '/api',
      specification: { method: 'get', version: { min: 2, max: 2 } },
    })
    expect(r2).toEqual(['/api/v2/f'])
  })

  test('uses custom path from specification', () => {
    const r3 = getPathsFromSpecification({
      functionName: 'f',
      maxVersion: 2,
      prefix: '/api',
      specification: { method: 'get', path: '/custom/{id}' },
    })
    expect(r3).toEqual(['/api/v1/custom/{id}', '/api/v2/custom/{id}'])
  })

  test('handles min version only', () => {
    const r4 = getPathsFromSpecification({
      functionName: 'f',
      maxVersion: 3,
      prefix: '/api',
      specification: { method: 'get', version: { min: 2 } },
    })
    expect(r4).toEqual(['/api/v2/f', '/api/v3/f'])
  })

  test('handles max version only', () => {
    const r5 = getPathsFromSpecification({
      functionName: 'f',
      maxVersion: 3,
      prefix: '/api',
      specification: { method: 'get', version: { max: 2 } },
    })
    expect(r5).toEqual(['/api/v1/f', '/api/v2/f'])
  })
})

describe('decodeQueryObject', () => {
  test('decodes nested object', () => {
    const decoded1 = decodeQueryObject({ 'input[id]': '1', 'input[meta][info]': 123 }, 'input')
    expect(decoded1).toEqual({ id: '1', meta: { info: 123 } })
  })

  test('decodes array-like indices as object', () => {
    const decoded2 = decodeQueryObject({ 'input[id]': '1', 'input[meta][0]': 1, 'input[meta][1]': 2 }, 'input')
    expect(decoded2).toEqual({ id: '1', meta: { 0: 1, 1: 2 } })
  })

  test('returns scalar value directly', () => {
    const decoded3 = decodeQueryObject({ input: '1' }, 'input')
    expect(decoded3).toEqual('1')
  })

  test('overwrites with later value for same path', () => {
    const decoded4 = decodeQueryObject({ 'input[meta]': 'true', 'input[meta][info]': 'info' }, 'input')
    expect(decoded4).toEqual({ meta: { info: 'info' } })
  })

  test('later scalar overwrites object', () => {
    const decoded5 = decodeQueryObject({ 'input[meta][info]': 'info', 'input[meta]': 'true' }, 'input')
    expect(decoded5).toEqual({ meta: 'true' })
  })

  test('returns undefined for missing prefix', () => {
    const decoded6 = decodeQueryObject({ other: '1' }, 'input')
    expect(decoded6).toBeUndefined()
  })

  test('handles empty object', () => {
    const decoded7 = decodeQueryObject({}, 'input')
    expect(decoded7).toBeUndefined()
  })

  test('handles deeply nested structures', () => {
    const decoded8 = decodeQueryObject({ 'input[a][b][c][d]': 'deep', 'input[a][b][e]': 'shallow' }, 'input')
    expect(decoded8).toEqual({ a: { b: { c: { d: 'deep' }, e: 'shallow' } } })
  })
})

describe('encodeQueryObject', () => {
  test('encodes nested object', () => {
    const encoded1 = encodeQueryObject({ id: '1', meta: { info: 123 } }, 'input')
    expect(encoded1).toEqual('input[id]=1&input[meta][info]=123')
  })

  test('encodes array', () => {
    const encoded2 = encodeQueryObject({ id: '1', meta: [1, 2] }, 'input')
    expect(encoded2).toEqual('input[id]=1&input[meta][0]=1&input[meta][1]=2')
  })

  test('encodes scalar value', () => {
    const encoded3 = encodeQueryObject('test', 'input')
    expect(encoded3).toEqual('=test')
  })

  test('encodes null value', () => {
    const encoded4 = encodeQueryObject(null, 'input')
    expect(encoded4).toEqual('=')
  })

  test('encodes number value', () => {
    const encoded5 = encodeQueryObject(42, 'input')
    expect(encoded5).toEqual('=42')
  })

  test('encodes boolean value', () => {
    const encoded6 = encodeQueryObject(true, 'input')
    expect(encoded6).toEqual('=true')
  })

  test('encodes undefined in object as null', () => {
    const encoded7 = encodeQueryObject({ a: undefined, b: 'value' }, 'input')
    expect(encoded7).toEqual('input[a]=&input[b]=value')
  })

  test('encodes nested array', () => {
    const encoded8 = encodeQueryObject(
      {
        items: [
          [1, 2],
          [3, 4],
        ],
      },
      'input',
    )
    expect(encoded8).toEqual('input[items][0][0]=1&input[items][0][1]=2&input[items][1][0]=3&input[items][1][1]=4')
  })
})

describe('methodFromOptions', () => {
  test('returns get for query operation', () => {
    expect(methodFromOptions({ operation: 'query' })).toEqual('get')
  })

  test('returns post for command operation', () => {
    expect(methodFromOptions({ operation: 'command' })).toEqual('post')
  })

  test('returns put for create command', () => {
    expect(methodFromOptions({ operation: { command: 'create' } })).toEqual('put')
  })

  test('returns post for update command', () => {
    expect(methodFromOptions({ operation: { command: 'update' } })).toEqual('post')
  })

  test('returns delete for delete command', () => {
    expect(methodFromOptions({ operation: { command: 'delete' } })).toEqual('delete')
  })

  test('returns post for empty options', () => {
    expect(methodFromOptions({})).toEqual('post')
  })

  test('returns post for undefined options', () => {
    expect(methodFromOptions(undefined)).toEqual('post')
  })
})
