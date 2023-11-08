import { idType } from '../common/model'
import { User } from '../user/model'
import { model } from '@mondrian-framework/model'

export type PostVisibility = model.Infer<typeof PostVisibility>
export const PostVisibility = model.enumeration(['PUBLIC', 'PRIVATE', 'FOLLOWERS']).setName('PostVisibility')

export type Post = model.Infer<typeof Post>
export const Post = () =>
  model.entity({
    id: idType,
    title: model.string(),
    content: model.string(),
    publishedAt: model.datetime(),
    author: User,
    likes: model.array(Like),
    visibility: PostVisibility,
  })

export type Like = model.Infer<typeof Like>
export const Like = () =>
  model.entity({
    id: idType,
    post: Post,
    user: User,
    createdAt: model.datetime(),
  })
