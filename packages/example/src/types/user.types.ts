import { Id } from './scalars.types'
import a from '@mondrian-framework/advanced-types'
import t from '@mondrian-framework/model'

export const User = () =>
  t
    .object({
      id: Id,
      email: a.email(),
      name: t.string({ minLength: 3, maxLength: 20 }).nullable(),
      posts: t.reference(t.array(Post)),
      audit: Audit,
    })
    .setName('User')
export type User = t.Infer<typeof User>

export const Audit = () =>
  t
    .object({
      createdAt: t.dateTime(),
    })
    .setName('Audit')
export type Audit = t.Infer<typeof Audit>

const M = t.dateTime().setName('Asd')

export const Post = () =>
  t
    .object({
      id: Id,
      title: t.string({ minLength: 1, maxLength: 200 }),
      content: t.string({ maxLength: 5000 }).nullable(),
      published: t.boolean(),
      author: t.reference(User),
    })
    .setName('Post')
export type Post = t.Infer<typeof Post>

export const UserFilter = t
  .object({
    id: Id.optional(),
  })
  .setName('UserFilter')
export type UserFilter = t.Infer<typeof UserFilter>

export const LoginInput = t
  .object({
    email: a.email(),
    password: t.string({ minLength: 1, maxLength: 100 }),
  })
  .setName('LoginInput')
export type LoginInput = t.Infer<typeof LoginInput>

export const RegisterInput = t.merge(
  t.pick(User, {
    email: true,
    name: true,
  }),
  t.object({
    password: t.string({ minLength: 5, maxLength: 100 }),
    audit: Audit,
  }),
  t.Mutability.Immutable,
  { name: 'RegisterInput' },
)
export type RegisterInput = t.Infer<typeof RegisterInput>

export const PostInput = t.pick(
  Post,
  {
    title: true,
    content: true,
  },
  t.Mutability.Immutable,
  { name: 'PostInput' },
)

export type PostInput = t.Infer<typeof PostInput>

export const Posts = t.array(Post).setName('Posts')

export const BasicFilter = t
  .object({
    skip: t.integer({ minimum: 0 }),
    take: t.integer({ minimum: 0, maximum: 20 }),
  })
  .setName('BasicFilter')

export type BasicFilter = t.Infer<typeof BasicFilter>
