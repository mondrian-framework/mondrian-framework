import { completeRetrieve } from '../src/utils'
import { types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('completeRetrieve', () => {
  const user = () =>
    types.entity({
      name: types.string(),
      tags: types.string().array(),
      friend: types.optional(user),
    })
  const userOrError = types.union({ user, error: types.string() })
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
