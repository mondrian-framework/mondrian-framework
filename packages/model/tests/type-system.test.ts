import m from '../src'
import { typeAssert } from './utils'
import { test } from 'vitest'

test('Type assertion', async () => {
  const Audit = m.object({ createdAt: m.datetime() })
  const User = () =>
    m.object({
      email: m.string(),
      name: m.string({ minLength: 3, maxLength: 20 }).nullable(),
      posts: m.relation(m.array(Post)),
      audit: Audit,
    })
  type InferredUser = m.Infer<typeof User>
  const Post = () =>
    m.object({
      title: m.string({ minLength: 1, maxLength: 200 }),
      content: m.string({ maxLength: 5000 }).nullable(),
      published: m.boolean(),
      likes: m.integer(),
      tags: m.enum(['A', 'B']).array().optional(),
      type: m.literal('POST').default('POST'),
      audit: m.merge(Audit, m.object({ lastEditAt: m.datetime() })),
      author: m.select(User, { email: true, name: true, audit: true }),
    })
  type User = {
    email: string
    name: string | null
    posts: Post[]
    audit: { createdAt: Date }
  }
  type Post = {
    title: string
    content: string | null
    published: boolean
    likes: number
    tags?: ('A' | 'B')[]
    type: 'POST'
    audit: { lastEditAt: Date; createdAt: Date }
    author: Omit<User, 'posts'>
  }
  typeAssert<InferredUser, User>({})

  const UserPost = m.union({ User, Post })
  type InferredUserPost = m.Infer<typeof UserPost>
  typeAssert<InferredUserPost, User | Post>({})
})
