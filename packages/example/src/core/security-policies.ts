import { Like, OwnPost, Post } from '../interface/post'
import { Follower, MyUser, User } from '../interface/user'
import { security } from '@mondrian-framework/module'

export const loggedUser: (userId: number) => security.Policies = (userId) =>
  security
    //ONLY FOR LOGGED-IN USERS
    .on(User)
    //Can read all fields if it's getting my user
    .allows({
      selection: true,
      restriction: { id: { equals: userId } },
    })
    //otherwise can read only this fields
    .allows({
      selection: { id: true, firstName: true, lastName: true },
    })

    .on(Post)
    //Can read all fields on post any post but with a given set of filters
    // - can read private posts only if author is me
    // - can read "followrs" posts only if i'm a follower of the author
    // - can read public post, always
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

    //This is needed to traverse the graph
    .on(Like)
    .allows({ selection: true })
    .on(Follower)
    .allows({ selection: true })
    .on(OwnPost)
    .allows({ selection: true })
    .on(MyUser)
    .allows({ selection: true })

export const guest: security.Policies = security

  //This is a wrap of User type that is returned only on register phase, and i can read anything
  .on(MyUser)
  .allows({ selection: true })

  //On other users i can read only the firstName as a guest
  .on(User)
  .allows({ selection: { firstName: true } })
