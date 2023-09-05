import advancedTypes from '@mondrian-framework/advanced-types'
import { types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

// Definition of users

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
      posts: { virtual: post().array() },
      metadata: userMetadata,
    },
    { name: 'user' },
  )

// Definition of posts

export type PostId = types.Infer<typeof postId>
export const postId = types.string({
  name: 'postId',
  description: 'an id that uniquely identifies a post',
})

export type Post = types.Infer<typeof post>
export const post = () =>
  types.object(
    {
      id: postId,
      title: types.string(),
      content: types.string(),
      published: types.dateTime(),
      author: user,
    },
    { name: 'post' },
  )

// User login

export type LoginUserContext = {
  findUser(email: string, password: string): Promise<UserId | undefined>
  updateLoginTime(id: UserId, loginTime: Date): Promise<User | undefined>
}

export const loginUserData = types.object({
  email: advancedTypes.email(),
  password: types.string().sensitive(),
})

export const loginUserResponse = types.union({
  loggedIn: user,
  failure: types.string(),
})

export const loginUser = functions.withContext<LoginUserContext>().build({
  input: loginUserData,
  output: loginUserResponse,
  body: async ({ input, context }) => {
    const { email, password } = input
    const userId = await context.findUser(email, password)
    if (!userId) {
      return { failure: 'invalid username or password' }
    }

    const now = new Date()
    const loggedUser = await context.updateLoginTime(userId, now)
    if (!loggedUser) {
      return { failure: "couldn't log in user" }
    }
    return { loggedIn: loggedUser }
  },
})

// User registration

export type RegisterUserContext = {
  addUser(email: string, password: string, firstName: string, lastName: string, metadata: UserMetadata): Promise<User>
}

export const registerUserData = types.object({
  password: types.string().sensitive(),
  email: advancedTypes.email(),
  firstName: types.string(),
  lastName: types.string(),
})

export const registerUser = functions.withContext<RegisterUserContext>().build({
  input: registerUserData,
  output: user,
  body: async ({ input, context }) => {
    const { email, password, firstName, lastName } = input
    const now = new Date()
    const metadata: UserMetadata = {
      createdAt: now,
      lastLogin: now,
    }
    return context.addUser(email, password, firstName, lastName, metadata)
  },
})
