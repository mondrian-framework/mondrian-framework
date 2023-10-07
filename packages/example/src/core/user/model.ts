import { idType } from '../common/model'
import { likeType, postType } from '../post/model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { types } from '@mondrian-framework/model'

export type UserType = types.Infer<typeof userType>
export const userType = () =>
  types.object(
    {
      id: idType,
      firstName: types.string(),
      lastName: types.string(),
      email: advancedTypes.email(),
      posts: { virtual: types.array(postType) },
      givenLikes: { virtual: types.array(likeType) },
      followers: { virtual: types.array(followerType) },
      followeds: { virtual: types.array(followerType) },
      metadata: types
        .object({
          createdAt: types.dateTime(),
          lastLogin: types.dateTime(),
        })
        .setName('UserMetadata'),
    },
    { name: 'User' },
  )

export type FollowerType = types.Infer<typeof userType>
export const followerType = () =>
  types.object(
    {
      id: idType,
      followed: { virtual: userType },
      follower: { virtual: userType },
    },
    { name: 'Follower' },
  )
