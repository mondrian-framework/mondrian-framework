import { User, UserId, UserMetadata, user } from './model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

// User login
export type LoginContext = {
  findUser(email: string, password: string): Promise<UserId | undefined>
  updateLoginTime(id: UserId, loginTime: Date): Promise<Omit<User, 'posts'> | undefined>
}

export const loginData = types.object({
  email: advancedTypes.email(),
  password: types.string().sensitive(),
})

export const login = functions.withContext<LoginContext>().build({
  input: loginData,
  output: user,
  error: aaa,
  body: async ({ input, context }) => {
    const { email, password } = input
    const userId = await context.findUser(email, password)
    if (!userId) {
      return result.fail({ invalidLogin: 'invalid username or password' })
    }

    const now = new Date()
    const loggedUser = await context.updateLoginTime(userId, now)
    if (!loggedUser) {
      return result.fail({ internalError: "couldn't log in user" })
    }
    return result.ok(loggedUser)
  },
})

// User registration
export type RegisterContext = {
  addUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    metadata: UserMetadata,
  ): Promise<Omit<User, 'posts'>>
}

export const registerData = types.object({
  password: types.string().sensitive(),
  email: advancedTypes.email(),
  firstName: types.string(),
  lastName: types.string(),
})

export const register = functions.withContext<RegisterContext>().build({
  input: registerData,
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
