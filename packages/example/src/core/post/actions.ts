import { LoggedUserContext } from '..'
import { idType, unauthorizedType } from '../common/model'
import { postType } from './model'
import { result, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { utils as prismaUtils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'

const writePostInput = () =>
  types.pick(postType(), { content: true, title: true, visibility: true }).setName('WritePostInput')
export const writePost = functions.withContext<LoggedUserContext>().build({
  input: writePostInput,
  output: postType,
  error: unauthorizedType,
  body: async ({ input, projection, context }) => {
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' as const })
    }
    const select = prismaUtils.projectionToSelection<Prisma.PostSelect>(postType, projection)
    const newPost = await context.prisma.post.create({
      data: {
        ...input,
        publishedAt: new Date(),
        authorId: context.userId,
      },
      select,
    })
    return result.ok(newPost)
  },
  options: { namespace: 'post' },
})

const readPostInput = types.object({ authorId: idType }).setName('ReadPostsInput')
export const readPosts = functions.withContext<LoggedUserContext>().build({
  input: readPostInput,
  output: types.array(postType),
  error: types.never(),
  body: async ({ input, context, projection }) => {
    const select = prismaUtils.projectionToSelection<Prisma.PostSelect>(postType, projection)
    const posts = await context.prisma.post.findMany({
      where: {
        authorId: input.authorId,
        OR: [
          { visibility: 'PUBLIC' },
          ...(context.userId
            ? ([
                { visibility: 'FOLLOWERS', author: { followers: { some: { followerId: context.userId } } } },
                { visibility: 'PRIVATE', authorId: context.userId },
              ] as const)
            : []),
        ],
      },
      select,
    })
    return result.ok(posts)
  },
  options: { namespace: 'post' },
})

const likePostInput = types.object({ postId: idType })
export const likePost = functions.withContext<LoggedUserContext>().build({
  input: likePostInput,
  output: postType,
  error: types.union({ ...unauthorizedType.variants, postNotFound: idType }),
  body: async ({ input, projection, context }) => {
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' as const })
    }
    const canViewPost = await context.prisma.post.findFirst({
      where: {
        id: input.postId,
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'FOLLOWERS', author: { followers: { some: { followerId: context.userId } } } },
          { visibility: 'PRIVATE', authorId: context.userId },
        ],
      },
    })
    if (!canViewPost) {
      return result.fail({ postNotFound: input.postId })
    }
    await context.prisma.like.upsert({
      create: {
        createdAt: new Date(),
        postId: input.postId,
        userId: context.userId,
      },
      where: {
        userId_postId: {
          postId: input.postId,
          userId: context.userId,
        },
      },
      update: {},
    })
    const select = prismaUtils.projectionToSelection<Prisma.PostSelect>(postType, projection)
    const post = await context.prisma.post.findFirstOrThrow({ where: { id: input.postId }, select })
    return result.ok(post)
  },
  options: { namespace: 'post' },
})
