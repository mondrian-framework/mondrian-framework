import { LoggedUserContext } from '..'
import { idType, unauthorizedType } from '../common/model'
import { postType, postVisibilityType } from './model'
import { result, retrieve, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { Prisma } from '@prisma/client'

const writePostInput = () =>
  types
    .object({ content: types.string(), title: types.string(), visibility: postVisibilityType })
    .setName('WritePostInput')
export const writePost = functions.withContext<LoggedUserContext>().build({
  input: writePostInput,
  output: postType,
  error: unauthorizedType,
  body: async ({ input, retrieve, context }) => {
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' as const })
    }
    const newPost = await context.prisma.post.create({
      data: {
        ...input,
        publishedAt: new Date(),
        authorId: context.userId,
      },
    })
    return result.ok(newPost)
  },
  options: { namespace: 'post' },
})

export const readPosts = functions.withContext<LoggedUserContext>().build({
  input: types.never(),
  output: types.array(postType),
  error: types.never(),
  body: async ({ context, retrieve: thisRetrieve }) => {
    const baseFilter: Prisma.PostWhereInput = {
      OR: [
        { visibility: 'PUBLIC' },
        ...(context.userId
          ? ([
              { visibility: 'FOLLOWERS', author: { followers: { some: { followerId: context.userId } } } },
              { visibility: 'PRIVATE', authorId: context.userId },
            ] as const)
          : []),
      ],
    }
    context.prisma.post.findFirst({})
    const args = retrieve.merge<Prisma.PostFindManyArgs>(types.array(postType), { where: baseFilter }, thisRetrieve)
    const posts = await context.prisma.post.findMany(args)
    return result.ok(posts)
  },
  options: { namespace: 'post' },
})

const likePostInput = types.object({ postId: idType }, { name: 'LikePostInput' })
export const likePost = functions.withContext<LoggedUserContext>().build({
  input: likePostInput,
  output: postType,
  error: types.union({ ...unauthorizedType.variants, postNotFound: idType }, { name: 'LikePostError' }),
  body: async ({ input, retrieve, context }) => {
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
    const post = await context.prisma.post.findFirstOrThrow({ where: { id: input.postId } })
    return result.ok(post)
  },
  options: { namespace: 'post' },
})
