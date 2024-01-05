import { module } from '../../interface'
import { User } from '../../interface/user'
import { slotProvider } from '../../rate-limiter'
import { Context, LoggedUserContext } from '../context'
import { result } from '@mondrian-framework/model'
import { retrieve } from '@mondrian-framework/module'
import { RateLiteral, rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

const loginRateLimit: RateLiteral = '10 requests in 1 minute'
export const login = module.functions.login.implement<Context>({
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
  middlewares: [
    rateLimiter.build({
      key: ({ input }) => input.email,
      rate: loginRateLimit,
      onLimit: async () => {
        //Improvement: warn the user, maybe block the account
        return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })
      },
      slotProvider,
    }),
    {
      name: 'Dummy',
      async apply(args, next, fn) {
        //do something before
        const result = await next(args)
        //do somthign after
        return result
      },
    },
  ],
})

export const register = module.functions.register.implement<Context>({
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
})

export const follow = module.functions.follow.implement<LoggedUserContext>({
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
})

export const getUsers = module.functions.getUsers.implement<LoggedUserContext>({
  body: async ({ context, retrieve: thisRetrieve }) => {
    const users = await context.prisma.user.findMany(thisRetrieve)
    return result.ok(users)
  },
})
