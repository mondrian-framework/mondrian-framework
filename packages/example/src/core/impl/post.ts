import { module } from '../../interface'
import { PostVisibility } from '../../interface/post'
import { authProvider, dbProvider, optionalAuthProvider } from '../providers'

export const writePost = module.functions.writePost
  .with({ providers: { auth: authProvider, db: dbProvider } })
  .implement({
    async body({ input, retrieve, db: { prisma }, auth: { userId }, ok }) {
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
      return ok(post)
    },
  })

export const readPosts = module.functions.readPosts
  .with({ providers: { db: dbProvider, auth: optionalAuthProvider } })
  .implement({
    async body({ db: { prisma }, retrieve, ok }) {
      const posts = await prisma.post.findMany(retrieve)
      return ok(posts)
    },
  })

export const likePost = module.functions.likePost
  .with({ providers: { auth: authProvider, db: dbProvider } })
  .implement({
    async body({ input, retrieve, auth: { userId }, db: { prisma }, ok, errors }) {
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
        return errors.postNotFound()
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
      return ok(post)
    },
  })
