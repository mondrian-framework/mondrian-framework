import { idType } from '../common/model'
import { likeType, postType } from '../post/model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { types } from '@mondrian-framework/model'

export type UserType = types.Infer<typeof userType>
export const userType = () =>
  types.entity(
    {
      id: idType,
      firstName: types.string(),
      lastName: types.string({ description: 'Lastname of user' }),
      email: advancedTypes.email(),
      posts: types.array(postType),
      givenLikes: types.array(likeType),
      followers: types.array(followerType),
      followeds: types.array(followerType),
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
  types.entity(
    {
      id: idType,
      followed: userType,
      follower: userType,
    },
    { name: 'Follower' },
  )
