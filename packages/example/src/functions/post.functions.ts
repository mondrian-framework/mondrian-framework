import { Id } from '../types/scalars.types'
import { BasicFilter, Post, PostInput, Posts } from '../types/user.types'
import { SharedContext } from './functions.commons'
import t from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { utils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'

const func = functions.withContext<SharedContext>()

export const checkPost = func.build({
  input: t.unknown(),
  output: t.object({ passedPosts: Id.array(), blockedPosts: Id.array() }),
  async body({ input, context, projection, operationId }) {
    return { blockedPosts: [], passedPosts: [] }
  },
  options: { namespace: 'post' },
})

export const publish = func.build({
  input: PostInput,
  output: Post,
  async body({ input, context, projection, operationId }) {
    if (context.auth?.userId == null) {
      throw new Error('Unauthorized')
    }
    const select = utils.projectionToSelection<Prisma.PostSelect>(Post, projection)
    const post = await context.prisma.post.create({
      data: { title: input.title, content: input.content, authorId: context.auth.userId },
      select,
    })
    return post
  },
  options: { namespace: 'post' },
})

export const myPosts = func.build({
  input: BasicFilter,
  output: Posts,
  async body({ input, context, projection, operationId }) {
    if (context.auth?.userId == null) {
      throw new Error('Unauthorized')
    }
    const select = utils.projectionToSelection<Prisma.PostSelect>(Post, projection)
    const posts = await context.prisma.post.findMany({ where: { authorId: context.auth.userId }, select, ...input })
    return posts
  },
})
