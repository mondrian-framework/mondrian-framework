import { LoggedUserContext } from '..'
import { module } from '../../interface'
import { PostVisibility } from '../../interface/post'
import { result } from '@mondrian-framework/model'

export const writePost = module.functions.writePost.implement<LoggedUserContext>({
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
})

export const readPosts = module.functions.readPosts.implement<LoggedUserContext>({
  body: async ({ context, retrieve }) => {
    const posts = await context.prisma.post.findMany(retrieve)
    return posts
  },
})

export const likePost = module.functions.likePost.implement<LoggedUserContext>({
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
})
