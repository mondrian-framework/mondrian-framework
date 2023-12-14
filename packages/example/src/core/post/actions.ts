import { LoggedUserContext } from '..'
import { idType } from '../common/model'
import { Post, PostVisibility } from './model'
import { result, model } from '@mondrian-framework/model'
import { functions, retrieve } from '@mondrian-framework/module'
import { Prisma } from '@prisma/client'

export const writePost = functions.withContext<LoggedUserContext>().build({
  input: model.pick(Post, { title: true, content: true, visibility: true }, { name: 'WritePostInput' }),
  output: Post,
  errors: { notLoggedIn: model.string() },
  retrieve: { select: true },
  body: async ({ input, retrieve, context }) => {
    if (PostVisibility.decode(input.visibility).isFailure) {
      throw new Error(`Invalid post visibility. Use one of ${PostVisibility.variants}`)
    }
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' })
    }
    const post = await context.prisma.post.create({
      data: {
        ...input,
        publishedAt: new Date(),
        authorId: context.userId,
      },
      select: retrieve.select,
    })
    return result.ok(post)
  },
  options: {
    namespace: 'post',
    description: 'Inser a new post by provind the title, content and visibility. Available only for logged user.',
  },
})

export const readPosts = functions.withContext<LoggedUserContext>().build({
  input: model.never(),
  output: model.array(Post),
  retrieve: retrieve.allCapabilities,
  body: async ({ context, retrieve }) => {
    const posts = await context.prisma.post.findMany(retrieve)
    return posts
  },
  options: {
    namespace: 'post',
    description: 'Gets posts of a specific user. The visibility of posts can vary based on viewer.',
  },
})

export const likePost = functions.withContext<LoggedUserContext>().build({
  input: model.object({ postId: idType }, { name: 'LikePostInput' }),
  output: Post,
  errors: { notLoggedIn: model.string(), postNotFound: model.string() },
  retrieve: { select: true },
  body: async ({ input, retrieve, context }) => {
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' })
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
      return result.fail({ postNotFound: 'Post not found' })
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
    const post = await context.prisma.post.findFirstOrThrow({ where: { id: input.postId }, select: retrieve.select })
    return result.ok(post)
  },
  options: {
    namespace: 'post',
    description: 'Add a like to a post you can view. Available only for logged user.',
  },
})
