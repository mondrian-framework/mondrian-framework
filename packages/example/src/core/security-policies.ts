import { Like, Post } from './post'
import { Follower, MyUser, User } from './user'
import { model } from '@mondrian-framework/model'
import { security } from '@mondrian-framework/module'

export const loggedUser: (userId: number) => security.Policies = (userId) =>
  security

    .on(User)
    .allows({
      selection: true,
      restriction: { id: { equals: userId } },
    })
    .allows({
      selection: { id: true, firstName: true, lastName: true },
    })

    .on(Post)
    .allows({
      selection: true,
      filter: { visibility: { equals: 'PRIVATE' }, author: { id: { equals: userId } } },
    })
    .allows({
      selection: true,
      filter: {
        visibility: { equals: 'FOLLOWERS' },
        author: { followers: { some: { follower: { id: { equals: userId } } } } },
      },
    })
    .allows({
      selection: true,
      filter: { visibility: { equals: 'PUBLIC' } },
    })

    .on(Like)
    .allows({ selection: true })

    .on(Follower)
    .allows({ selection: true })

export const guest: security.Policies = security

  .on(MyUser)
  .allows({ selection: true })

  .on(User)
  .allows({ selection: { firstName: true } })
