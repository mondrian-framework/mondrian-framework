import { types } from '../types'
import f from './functions.commons'
import { PrismaUtils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'

export const checkPost = f({
  input: 'Void',
  output: 'CheckPostOutput',
  async apply({ input, context, projection, operationId }) {
    return { blockedPosts: [], passedPosts: [] }
  },
})

export const publish = f({
  input: 'PostInput',
  output: 'Post',
  async apply({ input, context, projection, operationId }) {
    if (context.auth?.userId == null) {
      throw new Error('Unauthorized')
    }
    const select = PrismaUtils.projectionToSelection<Prisma.PostSelect>(projection, types.Post)
    const post = await context.prisma.post.create({ data: { ...input, authorId: context.auth.userId }, select })
    return post
  },
})

export const myPosts = f({
  input: 'BasicFilter',
  output: 'Posts',
  async apply({ input, context, projection, operationId }) {
    if (context.auth?.userId == null) {
      throw new Error('Unauthorized')
    }
    const select = PrismaUtils.projectionToSelection<Prisma.PostSelect>(projection, types.Post)
    const posts = await context.prisma.post.findMany({ where: { authorId: context.auth.userId }, select, ...input })
    return posts
  },
})
