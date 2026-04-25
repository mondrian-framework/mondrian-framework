import { module } from '../../interface'
import { authProvider, dbProvider, optionalAuthProvider } from '../providers'
import { result, model } from '@mondrian-framework/model'

export const writePost = module.functions.writePost
  .use({ providers: { auth: authProvider, db: dbProvider } })
  .implement({
    async body({ input, retrieve, db: { prisma }, auth: { userId } }) {
      const post = await prisma.post.create({
        data: {
          ...input,
          publishedAt: new Date(),
          authorId: userId,
        },
        select: retrieve.select,
      })
      return result.ok(post as never)
    },
  })

export const readPosts = module.functions.readPosts
  .use({ providers: { db: dbProvider, auth: optionalAuthProvider } })
  .implement({
    async body({ db: { prisma }, retrieve }) {
      const [posts, totalCount] = await prisma.$transaction([
        prisma.post.findMany(retrieve),
        prisma.post.count({ where: retrieve.where }),
      ])
      return result.ok(new model.TotalCountArray(totalCount, posts) as never)
    },
  })

export const likePost = module.functions.likePost.use({ providers: { auth: authProvider, db: dbProvider } }).implement({
  async body({ input, retrieve, auth: { userId }, db: { prisma } }) {
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
      return result.fail({ postNotFound: {} })
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
    return result.ok(post as never)
  },
})
