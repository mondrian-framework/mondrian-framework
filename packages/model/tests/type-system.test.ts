/*
import m, { decodeAndValidate } from '../src'
import { Error, Result } from '../src/result'
import { expect, expectTypeOf, test } from 'vitest'

const Audit = m.object({ createdAt: m.datetime() })
const User = () =>
  m.object({
    type: m.literal('USER'),
    email: m.string(),
    name: m.string({ minLength: 3, maxLength: 20 }).nullable(),
    posts: m.relation(m.array(Post)),
    audit: Audit,
  })
type User = m.Infer<typeof User>
const Post = () =>
  m.object({
    type: m.literal('POST'),
    title: m.string({ minLength: 1, maxLength: 200 }),
    content: m.string({ maxLength: 5000 }).nullable(),
    published: m.boolean(),
    likes: m.integer().default(0),
    tags: m.enum(['A', 'B']).array().optional(),
    audit: m.merge(Audit, m.object({ lastEditAt: m.datetime() })),
    author: m.nullable(m.select(User, { email: true, name: true, audit: true, type: true })),
  })
type Post = m.Infer<typeof Post>
const UserPost = m.union(
  { User, Post },
  {
    requiredProjection: { User: { type: true }, Post: { type: true } },
    is: {
      Post: (v) => v.type === 'POST',
      User: (v) => v.type === 'USER',
    },
  },
)
type UserPost = m.Infer<typeof UserPost>

test('Type assertion', async () => {
  type ExpectedUser = {
    type: 'USER'
    email: string
    name: string | null
    posts: ExpectedPost[]
    audit: { createdAt: Date }
  }
  type ExpectedPost = {
    type: 'POST'
    title: string
    content: string | null
    published: boolean
    likes: number
    tags?: ('A' | 'B')[]
    audit: { lastEditAt: Date; createdAt: Date }
    author: Omit<ExpectedUser, 'posts'> | null
  }
  typeAssert<User, ExpectedUser>({})
  typeAssert<UserPost, ExpectedUser | ExpectedPost>({})
  expectTypeOf()
})

test('Decode & validate (1)', async () => {
  const result = decodeAndValidate(
    User,
    {
      type: 'USER',
      email: 'asd@gmail.com',
      name: 'asd',
      posts: [],
      audit: { createdAt: '2023-06-05T09:13:29Z' },
      a: undefined,
    },
    { cast: false, strict: true, errors: 'exhaustive' },
  )
  expectSuccess(result, {
    type: 'USER',
    email: 'asd@gmail.com',
    name: 'asd',
    posts: [],
    audit: { createdAt: new Date('2023-06-05T09:13:29Z') },
  })
})
test('Decode & validate (2)', async () => {
  const result = decodeAndValidate(
    User,
    {
      type: 'USER',
      email: 'asd@gmail.com',
      name: 'asd',
      posts: [],
      audit: { createdAt: '2023-06-05T09:13:29Z' },
      a: 123,
    },
    { cast: false, strict: true, errors: 'exhaustive' },
  )
  expectFailure(result, [{ error: 'Value not expected', path: '.a', value: 123 }])
})
test('Decode & validate (3)', async () => {
  const result = decodeAndValidate(
    User,
    {
      type: 'USER',
      email: 'asd@gmail.com',
      name: 'asd',
      posts: [{ title: '' }],
      audit: { createdAt: '2023-06-05T09:13:29Z' },
    },
    { cast: true, strict: true, errors: 'exhaustive' },
  )
  expectFailure(result, [
    { error: 'Literal POST expected', value: undefined, path: '.posts[0].type' },
    { error: 'Boolean expected', value: undefined, path: '.posts[0].published' },
    { error: 'Object expected', value: undefined, path: '.posts[0].audit' },
  ])
})

test('Decode & validate (4)', async () => {
  const result = decodeAndValidate(
    User,
    {
      type: 'USER',
      email: 'asd@gmail.com',
      name: 'asd',
      posts: [
        {
          type: 'POST',
          published: false,
          title: '',
          audit: { lastEditAt: '2023-06-05T09:13:29Z', createdAt: '2023-06-05T09:13:29Z' },
        },
      ],
      audit: { createdAt: '2023-06-05T09:13:29Z' },
    },
    { cast: true, strict: true, errors: 'exhaustive' },
  )
  expectFailure(result, [{ error: 'String shorter than min length (1)', value: '', path: '.posts[0].title' }])
})

test('Decode & validate (5)', async () => {
  const result = decodeAndValidate(
    User,
    {
      type: 'USER',
      email: 'asd@gmail.com',
      name: 'asd',
      posts: [
        {
          type: 'POST',
          published: false,
          title: 'Hello',
          audit: { lastEditAt: '2023-06-05T09:13:29Z', createdAt: '2023-06-05T09:13:29Z' },
        },
      ],
      audit: { createdAt: '2023-06-05T09:13:29Z' },
    },
    { cast: false, strict: true, errors: 'exhaustive' },
  )
  expectFailure(result, [
    { error: 'String expected', value: undefined, path: '.posts[0].content' },
    { error: 'Object expected', value: undefined, path: '.posts[0].author' },
  ])
})

test('Decode & validate (6)', async () => {
  const result = decodeAndValidate(
    User,
    {
      type: 'USER',
      email: 'asd@gmail.com',
      name: 'asd',
      posts: [
        {
          type: 'POST',
          published: false,
          title: 'Hello',
          audit: { lastEditAt: '2023-06-05T09:13:29Z', createdAt: '2023-06-05T09:13:29Z' },
        },
      ],
      audit: { createdAt: '2023-06-05T09:13:29Z' },
    },
    { cast: true, strict: true, errors: 'exhaustive' },
  )
  expectSuccess(result, {
    type: 'USER',
    email: 'asd@gmail.com',
    name: 'asd',
    posts: [
      {
        audit: { createdAt: new Date('2023-06-05T09:13:29Z'), lastEditAt: new Date('2023-06-05T09:13:29Z') },
        author: null,
        content: null,
        published: false,
        title: 'Hello',
        type: 'POST',
        likes: 0,
      },
    ],
    audit: { createdAt: new Date('2023-06-05T09:13:29Z') },
  })
})

test('Decode & validate (7)', async () => {
  const result = decodeAndValidate(
    m.select(UserPost, { Post: { type: true }, User: { type: true, posts: { title: true } } }),
    {
      type: 'USER',
      posts: [
        {
          title: 'Hello',
        },
      ],
    },
    { cast: false, strict: true, errors: 'exhaustive' },
  )
  expectSuccess(result, {
    type: 'USER',
    posts: [
      {
        title: 'Hello',
      },
    ],
  })
})

function expectSuccess<T>(result: Result<T>, value: T) {
  expect(result.success).true
  if (result.success) {
    expect(result.value).toStrictEqual(value)
  }
}

function expectFailure<T>(result: Result<T>, errors: Error[]) {
  expect(result.success).false
  if (!result.success) {
    expect(result.errors).toStrictEqual(errors)
  }
}
*/
