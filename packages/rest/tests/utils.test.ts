import { completeProjection } from '../src/utils'
import { types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('completeProjection', () => {
  const user = () =>
    types.object({
      name: types.string(),
      tags: types.string().array(),
      friend: { virtual: types.optional(user) },
    })
  const userOrError = types.union({ user, error: types.string() })
  test('Do nothing with true projection', async () => {
    const p = completeProjection(true, user)
    expect(p).toEqual(true)
  })
  test('Add all non virtual fields to projection', async () => {
    const p = completeProjection({}, user)
    expect(p).toEqual({ name: true, tags: true })
  })
  test('Add all non virtual fields to projection recursively', async () => {
    const p = completeProjection({ friend: { friend: true } }, user)
    expect(p).toEqual({ name: true, tags: true, friend: { name: true, tags: true, friend: true } })
  })
  test('Add all non virtual fields to projection of union', async () => {
    const p = completeProjection({ user: { friend: { friend: true } } }, userOrError)
    expect(p).toEqual({
      user: { name: true, tags: true, friend: { name: true, tags: true, friend: true } },
      error: true,
    })
  })
})
