import { users } from '..'
import { Post, post } from './model'
import { projection, result, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

export type Context = WriteContext & ReadContext

export const writeInput = types.object({
  title: types.string(),
  content: types.string(),
  authorId: types.string(),
})

export const writeError = types.union({
  invalidAuthor: types.string(),
})

type WriteContext = {
  doesUserExist: (id: users.UserId) => Promise<boolean>
  addPost: (title: string, content: string, publishedAt: Date, authorId: string) => Promise<Omit<Post, 'author'>>
}

const postWithNoAuthor = () => types.omit(post(), { author: true })

export const write = functions.withContext<WriteContext>().build({
  input: writeInput,
  output: postWithNoAuthor,
  error: writeError,
  body: async ({ input, context }) => {
    const { title, content, authorId } = input

    const userExists = await context.doesUserExist(authorId)
    if (!userExists) {
      return result.fail({ invalidAuthor: 'the provided author is invalid' })
    }

    const now = new Date()
    const newPost = await context.addPost(title, content, now, authorId)
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
  output: types.array(types.partialDeep(postWithNoAuthor)),
  error: types.never(),
  body: async ({ input, context, projection }) => {
    const { authorId } = input
    const posts = await context.findPostsByAuthor(authorId, projection)
    return result.ok(posts)
  },
})
