import { slotProvider } from '../../rate-limiter'
import { idType } from '../common/model'
import { Context, LoggedUserContext } from '../context'
import { User, MyUser } from './model'
import { result, model } from '@mondrian-framework/model'
import { functions, retrieve } from '@mondrian-framework/module'
import { RateLiteral, rateLimiter } from '@mondrian-framework/rate-limiter'
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

const loginRateLimit: RateLiteral = '10 requests in 1 minute'
const loginRateLimiter = rateLimiter.build<
  typeof LoginInput,
  typeof LoginOutput,
  typeof loginErrorMap,
  undefined,
  Context
>({
  key: ({ input }) => input.email,
  rate: loginRateLimit,
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
  body: async ({ input, context, logger }) => {
    const { email, password } = input
    const loggedUser = await context.prisma.user.findFirst({ where: { email, password }, select: { id: true } })
    if (!loggedUser) {
      logger.logWarn(`${input.email} failed login`)
      return result.fail({ invalidLogin: 'invalid username or password' })
    }
    await context.prisma.user.update({
      where: { id: loggedUser.id },
      data: { loginAt: new Date() },
    })
    const secret = process.env.JWT_SECRET ?? 'secret'
    const jwt = jsonwebtoken.sign({ sub: loggedUser.id }, secret)
    return result.ok(jwt)
  },
  middlewares: [loginRateLimiter],
  options: {
    description: `Gets the jwt of a user. This operation is rate limited at "${loginRateLimit}" on the same email`,
  },
})

export const register = functions.withContext<Context>().build({
  input: model.object(
    {
      password: model.string().sensitive(),
      email: model.email(),
      firstName: model.string(),
      lastName: model.string(),
    },
    {
      name: 'RegisterInput',
    },
  ),
  output: MyUser,
  errors: { emailAlreadyTaken: model.literal('Email already taken') },
  retrieve: { select: true },
  body: async ({ input, context, retrieve }) => {
    try {
      const user = await context.prisma.user.create({
        data: {
          ...input,
          registeredAt: new Date(),
          loginAt: new Date(),
        },
      })
      return result.ok(user)
    } catch {
      //unique index fail
      return result.fail({ emailAlreadyTaken: 'Email already taken' })
    }
  },
  options: {
    namespace: 'user',
    description: 'Creates a new user.',
  },
})

export const follow = functions.withContext<LoggedUserContext>().build({
  input: model.object({ userId: idType }),
  output: User,
  errors: { notLoggedIn: model.string(), userNotExists: model.string() },
  retrieve: { select: true },
  body: async ({ input, context, retrieve: thisRetrieve }) => {
    if (!context.userId) {
      return result.fail({ notLoggedIn: 'Invalid authentication' })
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
  options: {
    namespace: 'user',
    description: 'Adds a follower to your user. Available only for logged user.',
  },
})

export const getUsers = functions.withContext<LoggedUserContext>().build({
  input: model.never(),
  output: model.array(User),
  errors: { notLoggedIn: model.string() },
  retrieve: retrieve.allCapabilities,
  body: async ({ context, retrieve: thisRetrieve }) => {
    const users = await context.prisma.user.findMany(thisRetrieve)
    return result.ok(users)
  },
  options: {
    namespace: 'user',
    description: 'Gets some users.',
  },
})
