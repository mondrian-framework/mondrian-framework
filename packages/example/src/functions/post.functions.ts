import { PrismaUtils } from '@mondrian/prisma'
import f from './functions.commons'
import { Prisma } from '@prisma/client'
import { types } from '../types'

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
