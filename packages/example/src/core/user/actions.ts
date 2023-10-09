import { slotProvider } from '../../rate-limiter'
import { idType, unauthorizedType } from '../common/model'
import { Context, LoggedUserContext } from '../context'
import { userType } from './model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { projection, result, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { utils as prismaUtils } from '@mondrian-framework/prisma'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

const loginInputType = types.object(
  {
    email: advancedTypes.email(),
    password: types.string().sensitive(),
  },
  { name: 'LoginInput' },
)
const loginOutputType = types.object(
  {
    user: userType,
    jwt: types.string(),
  },
  { name: 'LoginOutput' },
)
const loginErrorType = types.union(
  {
    invalidLogin: types.string(),
    tooManyRequests: types.string(),
  },
  {
    name: 'LoginError',
  },
)

const loginRateLimiter = rateLimiter.build<
  typeof loginInputType,
  typeof loginOutputType,
  typeof loginErrorType,
  Context
>({
  key: ({ input }) => input.email,
  rate: '10 requests in 1 minute',
  onLimit: async () => {
    //TODO: warn the user, maybe block the account
    return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })
  },
  slotProvider,
})

export const login = functions.withContext<Context>().build({
  input: loginInputType,
  output: loginOutputType,
  error: loginErrorType,
  body: async ({ input, context, projection: proj }) => {
    const { email, password } = input
    const loggedUser = await context.prisma.user.findFirst({ where: { email, password }, select: { id: true } })
    if (!loggedUser) {
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
  error: undefined,
  body: async ({ input, context }) => {
    const { email, password, firstName, lastName } = input
    const now = new Date()
    const metadata: UserMetadata = {
      createdAt: now,
      lastLogin: now,
    }
    const addedUser = await context.addUser(email, password, firstName, lastName, metadata)
    return addedUser
  },
  middlewares: [
    {
      name: 'hideName',
      apply: async (args, next, thisFunction) => {
        const res = await next(args)

        return res
      },
    },
  ],
})
