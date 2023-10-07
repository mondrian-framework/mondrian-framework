import { idType } from '../common/model'
import { userType } from '../user/model'
import { types } from '@mondrian-framework/model'

export type PostVisibilityType = types.Infer<typeof postVisibilityType>
export const postVisibilityType = types.enumeration(['PUBLIC', 'PRIVATE', 'FOLLOWERS']).setName('PostVisibility')

export type PostType = types.Infer<typeof postType>
export const postType = () =>
  types.object(
    {
      id: idType,
      title: types.string(),
      content: types.string(),
      publishedAt: types.dateTime(),
      author: { virtual: userType },
      likes: { virtual: types.array(likeType) },
      visibility: postVisibilityType,
    },
    { name: 'Post' },
  )

export type LikeType = types.Infer<typeof likeType>
export const likeType = () =>
  types.object(
    {
      id: idType,
      post: { virtual: postType },
      user: { virtual: userType },
      createdAt: types.dateTime(),
    },
    { name: 'Like' },
  )
