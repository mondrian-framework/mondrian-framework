import t from '@mondrian/model'
import { Id, JWT } from './scalars.types'

export const User = () =>
  t.object({
    id: Id,
    email: t.string({ format: 'email', maxLength: 100 }),
    name: t.nullable(t.string({ minLength: 3, maxLength: 20 })),
    posts: t.hide(t.array(Post)),
  })
export type User = t.Infer<typeof User>

export const Post = () =>
  t.object({
    id: Id,
    title: t.string({ minLength: 1, maxLength: 200 }),
    content: t.nullable(t.string({ maxLength: 5000 })),
    published: t.boolean(),
    author: t.hide(User),
  })
export type Post = t.Infer<typeof Post>

export const UserFilter = t.object({
  id: t.optional(Id),
})
export type UserFilter = t.Infer<typeof UserFilter>

export const LoginInput = t.select(User(), { email: true, password: true })
export type LoginInput = t.Infer<typeof LoginInput>

export const RegisterInput = t.merge(
  t.select(User(), {
    email: true,
    name: true,
  }),
  t.object({ password: t.string({ minLength: 5, maxLength: 100 }) }),
)
export type RegisterInput = t.Infer<typeof RegisterInput>

export const PostInput = t.object({
  title: Post().type.title,
  content: Post().type.content,
})
export type PostInput = t.Infer<typeof PostInput>

export const RegisterOutput = t.object({ user: User, jwt: JWT })
export type RegisterOutput = t.Infer<typeof RegisterOutput>

export const UserOutputs = t.array(User)
export type UserOutputs = t.Infer<typeof UserOutputs>

export const CheckPostOutput = t.object({ passedPosts: t.array(Id), blockedPosts: t.array(Id) })
export type CheckPostOutput = t.Infer<typeof CheckPostOutput>
