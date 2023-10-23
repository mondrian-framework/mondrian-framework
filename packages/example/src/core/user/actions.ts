import { slotProvider } from '../../rate-limiter'
import { idType, unauthorizedType } from '../common/model'
import { Context, LoggedUserContext } from '../context'
import { userType } from './model'
import advancedTypes from '@mondrian-framework/advanced-types'
import { result, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
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
  body: async ({ input, context, retrieve }) => {
    const { email, password } = input
    const loggedUser = await context.prisma.user.findFirst({ where: { email, password }, select: { id: true } })
    if (!loggedUser) {
      return result.fail({ invalidLogin: 'invalid username or password' })
    }
    await context.prisma.user.update({
      where: { id: loggedUser.id },
      data: { metadata: { update: { lastLogin: new Date() } } },
    })
    const user = await context.prisma.user.findFirstOrThrow({ where: { id: loggedUser.id } })
    const secret = process.env.JWT_SECRET ?? 'secret'
    const jwt = jsonwebtoken.sign({ sub: loggedUser.id }, secret)
    return result.ok({ user, jwt })
  },
  middlewares: [loginRateLimiter],
  options: { namespace: 'user' },
})

const registerInputType = types.object(
  {
    password: types.string().sensitive(),
    email: advancedTypes.email(),
    firstName: types.string(),
    lastName: types.string(),
  },
  {
    name: 'RegisterInput',
  },
)
const registerErrorType = types.union(
  {
    emailAlreadyTaken: types.string(),
  },
  {
    name: 'RegisterError',
  },
)

export const register = functions.withContext<Context>().build({
  input: registerInputType,
  output: userType,
  error: registerErrorType,
  body: async ({ input, context, retrieve }) => {
    try {
      const user = await context.prisma.user.create({
        data: {
          ...input,
          metadata: {
            set: {
              createdAt: new Date(),
              lastLogin: new Date(),
            },
          },
        },
      })
      return result.ok(user)
    } catch {
      //TODO: check if error is "email duplicate"
      return result.fail({ emailAlreadyTaken: 'This email si already taken' })
    }
  },
  options: { namespace: 'user' },
})

export const follow = functions.withContext<LoggedUserContext>().build({
  input: types.object({ userId: idType }),
  output: userType,
  error: types.union({ ...unauthorizedType.variants, userNotExists: types.string() }),
  body: async ({ input, context }) => {
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' as const })
    }
    if (input.userId === context.userId || (await context.prisma.user.count({ where: { id: input.userId } })) === 0) {
      return result.fail({ userNotExists: "This user doesn't exists." })
    }
    await context.prisma.follower.upsert({
      create: {
        followerId: context.userId,
        followedId: input.userId,
      },
      where: {
        followedId_followerId: {
          followerId: context.userId,
          followedId: input.userId,
        },
      },
      update: {},
    })
    const user = await context.prisma.user.findFirstOrThrow({ where: { id: context.userId } })
    return result.ok(user)
  },
  options: { namespace: 'user' },
})
