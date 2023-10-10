import { LoggedUserContext, users } from '..'
import { idType, unauthorizedType } from '../common/model'
import { postType } from './model'
import { projection, result, types } from '@mondrian-framework/model'
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
})

type ReadContext = {
  findPostsByAuthor: (
    authorId: users.UserId,
    projection: projection.FromType<typeof post> | undefined,
  ) => Promise<Partial<Omit<Post, 'author'>>[]>
}

export const readInput = types.object({ authorId: users.userId })

export const read = functions.withContext<ReadContext>().build({
  input: readInput,
  output: types.partialDeep(postWithNoAuthor).array(),
  error: undefined,
  body: async ({ input, context, projection }) => {
    const { authorId } = input
    const posts = await context.findPostsByAuthor(authorId, projection)
    return posts
  },
  options: { namespace: 'post' },
})

const likePostInput = types.object({ postId: idType }, { name: 'LikePostInput' })
export const likePost = functions.withContext<LoggedUserContext>().build({
  input: likePostInput,
  output: postType,
  error: types.union({ ...unauthorizedType.variants, postNotFound: idType }, { name: 'LikePostError' }),
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
