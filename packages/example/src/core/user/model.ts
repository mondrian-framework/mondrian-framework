import { idType } from '../common/model'
import { likeType, postType } from '../post/model'
import { model } from '@mondrian-framework/model'

export type UserType = model.Infer<typeof userType>
export const userType = () =>
  model.entity(
    {
      id: idType,
      firstName: model.string(),
      lastName: model.string({ description: 'Lastname of user' }),
      email: model.email(),
      posts: model.array(postType),
      givenLikes: model.array(likeType),
      followers: model.array(followerType),
      followeds: model.array(followerType),
      metadata: model
        .object({
          createdAt: model.datetime(),
          lastLogin: model.datetime(),
        })
        .setName('UserMetadata'),
    },
    { name: 'User' },
  )

export type FollowerType = model.Infer<typeof userType>
export const followerType = () =>
  model.entity(
    {
      id: idType,
      followed: userType,
      follower: userType,
    },
    { name: 'Follower' },
  )
