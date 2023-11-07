import { slotProvider } from '../../rate-limiter'
import { idType, unauthorizedType, notLoggedInType } from '../common/model'
import { Context, LoggedUserContext } from '../context'
import { userType } from './model'
import { result, retrieve, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

const loginInputType = types.object(
  {
    email: types.email(),
    password: types.string().sensitive(),
  },
  { name: 'LoginInput' },
)
const loginOutputType = types.string({ name: 'LoginOutput' })
const loginErrorType = {
  invalidLogin: types.string(),
  tooManyRequests: types.string(),
} as const

const loginRateLimiter = rateLimiter.build<
  typeof loginInputType,
  typeof loginOutputType,
  typeof loginErrorType,
  undefined,
  Context
>({
  key: ({ input }) => input.email,
  rate: '10 requests in 1 minute',
  onLimit: async () => {
    //Improvement: warn the user, maybe block the account
    return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })
  },
  slotProvider,
})

export const login = functions.withContext<Context>().build({
  input: loginInputType,
  output: loginOutputType,
  errors: loginErrorType,
  retrieve: undefined,
  body: async ({ input, context, retrieve: thisRetrieve }) => {
    const { email, password } = input
    const loggedUser = await context.prisma.user.findFirst({ where: { email, password }, select: { id: true } })
    if (!loggedUser) {
      return result.fail({ invalidLogin: 'invalid username or password' })
    }
    await context.prisma.user.update({
      where: { id: loggedUser.id },
      data: { metadata: { update: { lastLogin: new Date() } } },
    })
    const secret = process.env.JWT_SECRET ?? 'secret'
    const jwt = jsonwebtoken.sign({ sub: loggedUser.id }, secret)
    return result.ok(jwt)
  },
  middlewares: [loginRateLimiter],
  options: {},
})

const registerInputType = types.object(
  {
    password: types.string().sensitive(),
    email: types.email(),
    firstName: types.string(),
    lastName: types.string(),
  },
  {
    name: 'RegisterInput',
  },
)

export const register = functions.withContext<Context>().build({
  input: registerInputType,
  output: userType,
  errors: {
    emailAlreadyTaken: types.literal('Email already taken'),
  },
  retrieve: { select: true },
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
      //unique index fail
      return result.fail({ emailAlreadyTaken: 'Email already taken' })
    }
  },
  options: { namespace: 'user' },
})

export const follow = functions.withContext<LoggedUserContext>().build({
  input: types.object({ userId: idType }),
  output: userType,
  errors: {
    unauthorizedType,
    notLoggedInType,
    userNotExists: types.string(),
  },
  retrieve: { select: true },
  body: async ({ input, context, retrieve: thisRetrieve }) => {
    if (!context.userId) {
      return result.fail({ notLoggedInType: 'Invalid authentication' })
    }
    if (input.userId === context.userId || (await context.prisma.user.count({ where: { id: input.userId } })) === 0) {
      return result.fail({ userNotExists: 'User does not exists' })
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
    const args = retrieve.merge<Prisma.UserFindFirstOrThrowArgs>(
      userType,
      { where: { id: context.userId }, select: { id: true } },
      thisRetrieve,
    )
    const user = await context.prisma.user.findFirstOrThrow(args)
    return result.ok(user)
  },
  options: { namespace: 'user' },
})
