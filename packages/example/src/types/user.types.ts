import t from '@mondrian/model'
import { Id, JWT } from './scalars.types'

const Asd = t.union({ a: t.number(), b: t.string() }).array().array().nullable().array()
type Asd = t.Infer<typeof Asd>

export const User = () =>
  t.object({
    id: Id,
    email: t.string({ format: 'email' }),
    name: t.string({ minLength: 3, maxLength: 20 }).nullable(),
    posts: t.relation(t.array(User)),
  })
export type User = t.Infer<typeof User>

export const Post = () =>
  t.object({
    id: Id,
    title: t.string({ minLength: 1, maxLength: 200 }),
    content: t.string({ maxLength: 5000 }).nullable(),
    published: t.boolean(),
    author: t.relation(User),
  })
export type Post = t.Infer<typeof Post>

export const UserFilter = t.object({
  id: Id.optional(),
})
export type UserFilter = t.Infer<typeof UserFilter>

export const LoginInput = t.object({
  email: t.string({ format: 'email' }),
  password: t.string({ minLength: 1, maxLength: 100 }),
})
export type LoginInput = t.Infer<typeof LoginInput>

export const RegisterInput = t.merge(
  t.select(User, {
    email: true,
    name: true,
  }),
  t.object({ password: t.string({ minLength: 5, maxLength: 100 }) }),
)
export type RegisterInput = t.Infer<typeof RegisterInput>

export const PostInput = t.select(Post, {
  title: true,
  content: true,
})
export type PostInput = t.Infer<typeof PostInput>

export const RegisterOutput = t.object({ user: User, jwt: JWT })
export type RegisterOutput = t.Infer<typeof RegisterOutput>

export const LoginOutput = t.nullable(t.object({ user: User, jwt: JWT }))
export type LoginOutput = t.Infer<typeof LoginOutput>

export const UserOutputs = t.array(User)
export type UserOutputs = t.Infer<typeof UserOutputs>

export const CheckPostOutput = t.object({ passedPosts: t.array(Id), blockedPosts: t.array(Id) })
export type CheckPostOutput = t.Infer<typeof CheckPostOutput>
