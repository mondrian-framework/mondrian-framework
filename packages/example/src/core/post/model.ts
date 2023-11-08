import { idType } from '../common/model'
import { userType } from '../user/model'
import { model } from '@mondrian-framework/model'

export type PostVisibilityType = model.Infer<typeof postVisibilityType>
export const postVisibilityType = model.enumeration(['PUBLIC', 'PRIVATE', 'FOLLOWERS']).setName('PostVisibility')

export type PostType = model.Infer<typeof postType>
export const postType = () =>
  model.entity(
    {
      id: idType,
      title: model.string(),
      content: model.string(),
      publishedAt: model.datetime(),
      author: userType,
      likes: model.array(likeType),
      visibility: postVisibilityType,
    },
    { name: 'Post' },
  )

export type LikeType = model.Infer<typeof likeType>
export const likeType = () =>
  model.entity(
    {
      id: idType,
      post: postType,
      user: userType,
      createdAt: model.datetime(),
    },
    { name: 'Like' },
  )
