import { idType } from '../common/model'
import { Like, Post } from '../post/model'
import { model } from '@mondrian-framework/model'

export type User = model.Infer<typeof User>
export const User = () =>
  model.entity({
    id: idType,
    firstName: model.string(),
    lastName: model.string(),
    email: model.email(),
    posts: model.array(Post),
    givenLikes: model.array(Like),
    followers: model.array(Follower),
    followeds: model.array(Follower),
    registeredAt: model.datetime(),
    loginAt: model.datetime(),
  })

export const MyUser = () => User
export type MyUser = User

export type Follower = model.Infer<typeof User>
export const Follower = () =>
  model.entity({
    id: idType,
    followed: User,
    follower: User,
  })
