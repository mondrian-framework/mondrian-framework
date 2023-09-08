import { post } from '../post/model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { types } from '@mondrian-framework/model'

export type UserId = types.Infer<typeof userId>
export const userId = types.string({
  name: 'userId',
  description: 'an id that uniquely identifies a user',
})

export type UserMetadata = types.Infer<typeof userMetadata>
export const userMetadata = types.object({
  createdAt: types.dateTime(),
  lastLogin: types.dateTime(),
})

export type User = types.Infer<typeof user>
export const user = () =>
  types.object(
    {
      id: userId,
      firstName: types.string(),
      lastName: types.string(),
      email: advancedTypes.email(),
      posts: { virtual: types.array(post) },
      metadata: userMetadata,
    },
    { name: 'user' },
  )
