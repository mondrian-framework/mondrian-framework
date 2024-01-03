import { idType } from '../common/model'
import { Like, Post } from '../post/model'
import { model } from '@mondrian-framework/model'

export type User = model.Infer<typeof User>
export const User = () =>
  model.entity(
    {
      id: idType,
      firstName: model.string(),
      lastName: model.string(),
      email: model.email(),
      posts: model.array(Post),
      givenLikes: model.array(Like),
      followers: model.describe(model.array(Follower), 'Users that follows me'),
      followeds: model.describe(model.array(Follower), 'Users followed by me'),
      registeredAt: model.datetime(),
      loginAt: model.datetime(),
    },
    { description: 'User of the system' },
  )

export const MyUser = () => User
export type MyUser = User

export type Follower = model.Infer<typeof User>
export const Follower = () =>
  model.entity({
    id: idType,
    followed: User,
    follower: User,
  })
