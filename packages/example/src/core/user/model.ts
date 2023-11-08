import { idType } from '../common/model'
import { Like, Post } from '../post/model'
import { model } from '@mondrian-framework/model'

export type User = model.Infer<typeof User>
export const User = () =>
  model.entity(
    {
      id: idType,
      firstName: model.string(),
      lastName: model.string({ description: 'Lastname of user' }),
      email: model.email(),
      posts: model.array(Post),
      givenLikes: model.array(Like),
      followers: model.array(Follower),
      followeds: model.array(Follower),
      metadata: model
        .object({
          createdAt: model.datetime(),
          lastLogin: model.datetime(),
        })
        .setName('UserMetadata'),
    },
    { name: 'User' },
  )

export type Follower = model.Infer<typeof User>
export const Follower = () =>
  model.entity(
    {
      id: idType,
      followed: User,
      follower: User,
    },
    { name: 'Follower' },
  )
