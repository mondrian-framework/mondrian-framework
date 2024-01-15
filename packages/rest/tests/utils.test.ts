import {
  assertApiValidity,
  completeRetrieve,
  decodeQueryObject,
  encodeQueryObject,
  getPathsFromSpecification,
  methodFromOptions,
} from '../src/utils'
import { model } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('completeRetrieve', () => {
  const user = () =>
    model.entity({
      name: model.string(),
      tags: model.string().array(),
      friend: model.optional(user),
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
})

test('assertApiValidity', () => {
  assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get' } } })
  expect(() =>
    assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', version: { min: 2 } } } }),
  ).toThrowError("Invalid version for function f1. 'min' must be between 1 and 1 and be an integer")
  expect(() =>
    assertApiValidity({ module: null as any, version: 3, functions: { f1: { method: 'get', version: { min: 2.2 } } } }),
  ).toThrowError("Invalid version for function f1. 'min' must be between 1 and 3 and be an integer")
  expect(() =>
    assertApiValidity({ module: null as any, version: 3, functions: { f1: { method: 'get', version: { max: 2.2 } } } }),
  ).toThrowError("Invalid version for function f1. 'max' must be between 1 and 3 and be an integer")
  expect(() =>
    assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', version: { max: 2 } } } }),
  ).toThrowError("Invalid version for function f1. 'max' must be between 1 and 1 and be an integer")
  expect(() =>
    assertApiValidity({
      module: null as any,
      version: 10,
      functions: { f1: { method: 'get', version: { max: 2, min: 3 } } },
    }),
  ).toThrowError("Invalid version for function f1. 'min' must be less than or equals to 'max'")
  expect(() =>
    assertApiValidity({ module: null as any, version: 1.5, functions: { f1: { method: 'get' } } }),
  ).toThrowError('Invalid api version. Must be between 1 and 100 and be an integer. Got 1.5')
  expect(() =>
    assertApiValidity({ module: null as any, version: -1, functions: { f1: { method: 'get' } } }),
  ).toThrowError('Invalid api version. Must be between 1 and 100 and be an integer. Got -1')
})

test('getPathsFromSpecification', () => {
  const r1 = getPathsFromSpecification({
    functionName: 'f',
    maxVersion: 3,
    prefix: '/api',
    specification: { method: 'get' },
  })
  expect(r1).toEqual(['/api/v1/f', '/api/v2/f', '/api/v3/f'])

  const r2 = getPathsFromSpecification({
    functionName: 'f',
    maxVersion: 3,
    prefix: '/api',
    specification: { method: 'get', version: { min: 2, max: 2 } },
  })
  expect(r2).toEqual(['/api/v2/f'])
})

test('decodeQueryObject', () => {
  const decoded1 = decodeQueryObject({ 'input[id]': '1', 'input[meta][info]': 123 }, 'input')
  expect(decoded1).toEqual({ id: '1', meta: { info: 123 } })

  const decoded2 = decodeQueryObject({ 'input[id]': '1', 'input[meta][0]': 1, 'input[meta][1]': 2 }, 'input')
  expect(decoded2).toEqual({ id: '1', meta: { 0: 1, 1: 2 } })

  const decoded3 = decodeQueryObject({ input: '1' }, 'input')
  expect(decoded3).toEqual('1')
})

test('encodeQueryObject', () => {
  const encoded1 = encodeQueryObject({ id: '1', meta: { info: 123 } }, 'input')
  expect(encoded1).toEqual('input[id]=1&input[meta][info]=123')

  const encoded2 = encodeQueryObject({ id: '1', meta: [1, 2] }, 'input')
  expect(encoded2).toEqual('input[id]=1&input[meta][0]=1&input[meta][1]=2')
})

test('methodFromOptions', () => {
  expect(methodFromOptions({ operation: 'query' })).toEqual('get')
  expect(methodFromOptions({ operation: 'command' })).toEqual('post')
  expect(methodFromOptions({ operation: { command: 'create' } })).toEqual('put')
  expect(methodFromOptions({ operation: { command: 'update' } })).toEqual('post')
  expect(methodFromOptions({ operation: { command: 'delete' } })).toEqual('delete')
  expect(methodFromOptions({})).toEqual('post')
})
