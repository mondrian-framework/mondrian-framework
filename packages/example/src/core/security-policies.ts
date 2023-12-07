import { Like, Post } from './post'
import { Follower, User } from './user'
import { security } from '@mondrian-framework/model'

export function user(userId: number) {
  return security

    .of(User)
    .read({
      selection: true,
      restriction: { id: { equals: userId } },
    })
    .read({
      selection: { id: true, firstName: true, lastName: true },
    })

    .of(Post)
    .read({
      selection: true,
      filter: { visibility: { equals: 'PRIVATE' }, author: { id: { equals: userId } } },
    })
    .read({
      selection: true,
      filter: {
        visibility: { equals: 'FOLLOWERS' },
        author: { followers: { some: { follower: { id: { equals: userId } } } } },
      },
    })
    .read({
      selection: true,
      filter: { visibility: { equals: 'PUBLIC' } },
    })

    .of(Like)
    .read({ selection: true })
    .of(Follower)
    .read({ selection: true })
    .build()
}

export const guest = security
  .of(User)
  .read({ selection: { firstName: true } })
  .build()
