import { slotProvider } from '../../rate-limiter'
import { User, UserId, UserMetadata, user } from './model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { result, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { rateLimitMiddleware } from '@mondrian-framework/rate-limiter'

export type Context = LoginContext & RegisterContext

// User login
type LoginContext = {
  findUser(email: string, password: string): Promise<UserId | undefined>
  updateLoginTime(id: UserId, loginTime: Date): Promise<Omit<User, 'posts'> | undefined>
}

export const loginData = types.object({
  email: advancedTypes.email(),
  password: types.string().sensitive(),
})

export const loginError = types.union({
  invalidLogin: types.string(),
  internalError: types.string(),
  tooManyRequests: types.string(),
})

const loginRateLimit = rateLimitMiddleware<typeof loginData, typeof user, typeof loginError, LoginContext>({
  key: ({ input }) => input.email,
  options: { rate: '10 requests in 10 minutes', slotProvider },
  onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })),
})

export const login = functions.withContext<LoginContext>().build({
  input: loginData,
  output: user,
  error: loginError,
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
  middlewares: [loginRateLimit],
})

// User registration
type RegisterContext = {
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
  output: types.omit(user, { posts: true })(),
  error: types.never(),
  body: async ({ input, context }) => {
    const { email, password, firstName, lastName } = input
    const now = new Date()
    const metadata: UserMetadata = {
      createdAt: now,
      lastLogin: now,
    }
    const addedUser = await context.addUser(email, password, firstName, lastName, metadata)
    return result.ok(addedUser)
  },
})
