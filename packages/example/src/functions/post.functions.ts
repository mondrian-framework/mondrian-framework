import { Types, types } from '../types'
import { SharedContext } from './functions.commons'
import { functionBuilder } from '@mondrian-framework/module'
import { PrismaUtils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'

const f = functionBuilder<Types, SharedContext>({ namespace: 'post' })

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
    const select = PrismaUtils.projectionToSelection<Prisma.PostSelect>(types.Post, projection)
    const post = await context.prisma.post.create({
      data: { title: input.title, content: input.content, authorId: context.auth.userId },
      select,
    })
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
    const select = PrismaUtils.projectionToSelection<Prisma.PostSelect>(types.Post, projection)
    const posts = await context.prisma.post.findMany({ where: { authorId: context.auth.userId }, select, ...input })
    return posts
  },
})
