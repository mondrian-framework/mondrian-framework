import jwt from 'jsonwebtoken'
import f from './functions.commons'
import { Prisma } from '@prisma/client'
import { LazyType, hasDecorator, lazyToType } from '@mondrian/model'
import { Post, User } from '../types'
import { GenericProjection } from '@mondrian/module'

export const register = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, fields, operationId }) {
    const userSelect = subField(fields, 'user')
    const select = fieldsToSelection<Prisma.UserSelect>(userSelect, User)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const login = f({
  input: 'LoginInput',
  output: 'LoginOutput',
  async apply({ input, context, fields, operationId }) {
    const userSelect = subField(fields, 'user')
    const select = fieldsToSelection<Prisma.UserSelect>(userSelect, User)
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
})

export const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, fields, operationId }) {
    const select = fieldsToSelection<Prisma.UserSelect>(fields, User)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
})

export const publish = f({
  input: 'PostInput',
  output: 'Post',
  async apply({ input, context, fields, operationId }) {
    if (context.auth?.userId == null) {
      throw new Error('Unauthorized')
    }
    const select = fieldsToSelection<Prisma.PostSelect>(fields, Post)
    const post = await context.prisma.post.create({ data: { ...input, authorId: context.auth.userId }, select })
    return post
  },
})

//TODO: move in prisma module
type FieldsKeys<T extends GenericProjection | undefined> = T extends Record<string, GenericProjection> ? keyof T : never
type SubFieldsSelection<T extends GenericProjection | undefined, K extends FieldsKeys<T>> = T extends undefined
  ? undefined
  : T extends true
  ? true
  : T extends Record<string, GenericProjection>
  ? T[K]
  : never
function subField<const T extends GenericProjection | undefined, const K extends FieldsKeys<T>>(
  fields: T,
  v: K,
): SubFieldsSelection<T, K> {
  if (fields === undefined || fields === true) {
    return fields as any
  }
  return (fields as any)[v]
}
function fieldsToSelection<T>(fields: GenericProjection | undefined, type: LazyType): T {
  const t = lazyToType(type)
  if (t.kind === 'object') {
    if (fields === true || fields == null) {
      const selection = Object.fromEntries(
        Object.entries(t.type).flatMap(([k, t]) => {
          if (hasDecorator(t, 'relation-decorator')) {
            return []
          }
          return [[k, true]]
        }),
      )
      return selection as any
    }
    const selection = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, t]) => {
        if (fields[k]) {
          const subSelection = fieldsToSelection(fields[k], t)
          if (hasDecorator(t, 'relation-decorator')) {
            return [[k, { select: subSelection }]]
          }
          return [[k, subSelection]]
        }
        return []
      }),
    )
    return selection as any
  }
  if (
    t.kind === 'array-decorator' ||
    t.kind === 'default-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'nullable-decorator' ||
    t.kind === 'relation-decorator'
  ) {
    return fieldsToSelection(fields, t.type)
  }
  if (t.kind === 'union-operator') {
    throw new Error('TODO')
  }
  return true as any
}
