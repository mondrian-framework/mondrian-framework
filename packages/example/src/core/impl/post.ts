import { module } from '../../interface'
import { PostVisibility } from '../../interface/post'
import { authProvider, dbProvider } from '../providers'
import { result } from '@mondrian-framework/model'

export const writePost = module.functions.writePost.withProviders({ auth: authProvider, db: dbProvider }).implement({
  body: async ({ input, retrieve, db: { prisma }, auth: { userId } }) => {
    if (PostVisibility.decode(input.visibility).isFailure) {
      throw new Error(`Invalid post visibility. Use one of ${PostVisibility.variants}`)
    }
    const post = await prisma.post.create({
      data: {
        ...input,
        publishedAt: new Date(),
        authorId: userId,
      },
      select: retrieve.select,
    })
    return result.ok(post)
  },
})

export const readPosts = module.functions.readPosts.withProviders({ db: dbProvider }).implement({
  body: async ({ db: { prisma }, retrieve }) => {
    const posts = await prisma.post.findMany(retrieve)
    return result.ok(posts)
  },
})

export const likePost = module.functions.likePost.withProviders({ auth: authProvider, db: dbProvider }).implement({
  body: async ({ input, retrieve, auth: { userId }, db: { prisma } }) => {
    const canViewPost = await prisma.post.findFirst({
      where: {
        id: input.postId,
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'FOLLOWERS', author: { followers: { some: { followerId: userId } } } },
          { visibility: 'PRIVATE', authorId: userId },
        ],
      },
    })
    if (!canViewPost) {
      return result.fail({ postNotFound: 'Post not found' })
    }
    await prisma.like.upsert({
      create: {
        createdAt: new Date(),
        postId: input.postId,
        userId: userId,
      },
      where: {
        userId_postId: {
          postId: input.postId,
          userId: userId,
        },
      },
      update: {},
    })
    const post = await prisma.post.findFirstOrThrow({ where: { id: input.postId }, select: retrieve.select })
    return result.ok(post)
  },
})
