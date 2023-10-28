import { retrieve, types } from '../src/index'
import { assertFailure, assertOk } from './testing-utils'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

const user = () =>
  types.entity({
    name: types.string(),
    bestFriend: types.optional(user),
    posts: types.array(post),
    metadata,
  })
type User = types.Infer<typeof user>
type PartialUser = types.Infer<types.PartialDeep<typeof user>>
const metadata = () =>
  types.object({
    registeredAt: types.dateTime(),
    loggedInAt: types.dateTime(),
  })
const post = () =>
  types.entity({
    title: types.string(),
    content: types.string(),
    author: user,
  })
type Post = types.Infer<typeof post>
type PartialPost = types.Infer<types.PartialDeep<typeof post>>

type UserRetrieve = retrieve.FromType<typeof user, { where: true; select: true; orderBy: true; take: true; skip: true }>
const r: UserRetrieve = { where: { NOT: {} } }

type PostRetrieve = retrieve.FromType<typeof post, { where: true; select: true; orderBy: true; take: true; skip: true }>
const p: PostRetrieve = { orderBy: { author: { posts: { _count: 'asc' } } } }

describe.concurrent('merge', () => {
  test('simple retrieve', () => {
    const result = retrieve.merge(
      user,
      { select: { name: true, posts: true }, where: { id: { equals: 'u2' } } },
      {
        select: { posts: { where: { id: { equals: 'p1' } }, select: { content: true } } },
        where: { name: { equals: 'Mario' } },
      },
    )
    expect(result).toEqual({
      where: { AND: [{ id: { equals: 'u2' } }, { name: { equals: 'Mario' } }] },
      select: {
        name: true,
        posts: { where: { id: { equals: 'p1' } }, select: { title: true, content: true, author: true } },
      },
    })
  })
})

//TODO ...
