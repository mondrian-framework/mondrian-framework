import { slotProvider } from '../../rate-limiter'
import { idType, unauthorizedType, notLoggedInType } from '../common/model'
import { Context, LoggedUserContext } from '../context'
import { User } from './model'
import { result, retrieve, model } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

const LoginInput = model.object(
  {
    email: model.email(),
    password: model.string().sensitive(),
  },
  { name: 'LoginInput' },
)
const LoginOutput = model.string({ name: 'LoginOutput' })
const loginErrorMap = {
  invalidLogin: model.string(),
  tooManyRequests: model.string(),
} as const

const loginRateLimiter = rateLimiter.build<
  typeof LoginInput,
  typeof LoginOutput,
  typeof loginErrorMap,
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
  input: LoginInput,
  output: LoginOutput,
  errors: loginErrorMap,
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

const RegisterInput = model.object(
  {
    password: model.string().sensitive(),
    email: model.email(),
    firstName: model.string(),
    lastName: model.string(),
  },
  {
    name: 'RegisterInput',
  },
)

export const register = functions.withContext<Context>().build({
  input: RegisterInput,
  output: User,
  errors: {
    emailAlreadyTaken: model.literal('Email already taken'),
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
  input: model.object({ userId: idType }),
  output: User,
  errors: {
    unauthorizedType,
    notLoggedInType,
    userNotExists: model.string(),
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
      User,
      { where: { id: context.userId }, select: { id: true } },
      thisRetrieve,
    )
    const user = await context.prisma.user.findFirstOrThrow(args)
    return result.ok(user)
  },
  options: { namespace: 'user' },
})
