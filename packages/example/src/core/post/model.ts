import { user } from '../user/model'
import { types } from '@mondrian-framework/model'

export type PostId = types.Infer<typeof postId>
export const postId = types.string({
  name: 'postId',
  description: 'an id that uniquely identifies a post',
})

export type Post = types.Infer<typeof post>
export const post = () =>
  types.object(
    {
      id: postId,
      title: types.string(),
      content: types.string(),
      publishedAt: types.dateTime(),
      author: user,
    },
    { name: 'post' },
  )
