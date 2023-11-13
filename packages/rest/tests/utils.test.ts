import { assertApiValidity, completeRetrieve } from '../src/utils'
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
  ).toThrow()
  expect(() =>
    assertApiValidity({ module: null as any, version: 3, functions: { f1: { method: 'get', version: { min: 2.2 } } } }),
  ).toThrow()
  expect(() =>
    assertApiValidity({ module: null as any, version: 3, functions: { f1: { method: 'get', version: { max: 2.2 } } } }),
  ).toThrow()
  expect(() =>
    assertApiValidity({ module: null as any, version: 1, functions: { f1: { method: 'get', version: { max: 2 } } } }),
  ).toThrow()
  expect(() =>
    assertApiValidity({
      module: null as any,
      version: 10,
      functions: { f1: { method: 'get', version: { max: 2, min: 3 } } },
    }),
  ).toThrow()
  expect(() => assertApiValidity({ module: null as any, version: 1.5, functions: { f1: { method: 'get' } } })).toThrow()
  expect(() => assertApiValidity({ module: null as any, version: -1, functions: { f1: { method: 'get' } } })).toThrow()
})
