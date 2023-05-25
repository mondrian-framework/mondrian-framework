import jwt from 'jsonwebtoken'
import f from './functions.commons'
import { Prisma } from '@prisma/client'
import { Post, User } from '../types'
import { PrismaUtils } from '@mondrian/prisma'
import { subProjection } from '@mondrian/model'

export const register = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, projection, operationId }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, User)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const login = f({
  input: 'LoginInput',
  output: 'LoginOutput',
  async apply({ input, context, projection, operationId }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, User, { posts: { take: 2 } })
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
})

export const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, projection, operationId }) {
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(projection, User)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
})

export const publish = f({
  input: 'PostInput',
  output: 'Post',
  async apply({ input, context, projection, operationId }) {
    if (context.auth?.userId == null) {
      throw new Error('Unauthorized')
    }
    const select = PrismaUtils.projectionToSelection<Prisma.PostSelect>(projection, Post)
    const post = await context.prisma.post.create({ data: { ...input, authorId: context.auth.userId }, select })
    return post
  },
})
