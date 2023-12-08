import { Like, Post } from './post'
import { Follower, MyUser, User } from './user'
import { security } from '@mondrian-framework/model'

export const loggedUser = (userId: number) =>
  security

    .on(User)
    .allows([
      {
        selection: true,
        restriction: { id: { equals: userId } },
      },
      {
        selection: { id: true, firstName: true, lastName: true },
      },
    ])

    .on(Post)
    .allows([
      {
        selection: true,
        filter: { visibility: { equals: 'PRIVATE' }, author: { id: { equals: userId } } },
      },
      {
        selection: true,
        filter: {
          visibility: { equals: 'FOLLOWERS' },
          author: { followers: { some: { follower: { id: { equals: userId } } } } },
        },
      },
      {
        selection: true,
        filter: { visibility: { equals: 'PUBLIC' } },
      },
    ])

    .on(Like)
    .allows({ selection: true })

    .on(Follower)
    .allows({ selection: true }).policies

export const guest = security

  .on(MyUser)
  .allows({ selection: true })

  .on(User)
  .allows({ selection: { firstName: true } }).policies
