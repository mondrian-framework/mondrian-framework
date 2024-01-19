import { module } from '../../interface'
import { User } from '../../interface/user'
import { slotProvider } from '../../rate-limiter'
import { authProvider, dbProvider, localizationProvider } from '../providers'
import { result } from '@mondrian-framework/model'
import { retrieve } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

export const login = module.functions.login
  .withProviders({ db: dbProvider, localization: localizationProvider })
  .implement({
    body: async ({ input, logger, db: { prisma } }) => {
      const { email, password } = input
      const loggedUser = await prisma.user.findFirst({ where: { email, password }, select: { id: true } })
      if (!loggedUser) {
        logger.logWarn(`${input.email} failed login`)
        return result.fail({ invalidLogin: 'invalid username or password' })
      }
      await prisma.user.update({
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
        rate: '10 requests in 1 minute',
        onLimit: async () => {
          //Improvement: warn the user, maybe block the account
          return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes. (Limited by Email)' })
        },
        slotProvider,
      }),
      rateLimiter.build({
        key: ({ localization: { ip } }) => ip,
        rate: '10000 requests in 1 hours',
        onLimit: async () => {
          return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes. (Limited by IP)' })
        },
        slotProvider,
      }),
    ],
  })

export const register = module.functions.register.withProviders({ db: dbProvider }).implement({
  body: async ({ input, db: { prisma } }) => {
    try {
      const user = await prisma.user.create({
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

export const follow = module.functions.follow.withProviders({ auth: authProvider, db: dbProvider }).implement({
  body: async ({ input, retrieve: thisRetrieve, auth: { userId }, db: { prisma } }) => {
    if (input.userId === userId || (await prisma.user.count({ where: { id: input.userId } })) === 0) {
      return result.fail({ userNotExists: 'User does not exists' })
    }
    await prisma.follower.upsert({
      create: {
        followerId: userId,
        followedId: input.userId,
      },
      where: {
        followedId_followerId: {
          followerId: userId,
          followedId: input.userId,
        },
      },
      update: {},
    })
    const args = retrieve.merge<Prisma.UserFindFirstOrThrowArgs>(
      User,
      { where: { id: userId }, select: { id: true } },
      thisRetrieve,
    )
    const user = await prisma.user.findFirstOrThrow(args)
    return result.ok(user)
  },
})

export const getUsers = module.functions.getUsers.withProviders({ auth: authProvider, db: dbProvider }).implement({
  body: async ({ retrieve: thisRetrieve, db: { prisma } }) => {
    const users = await prisma.user.findMany(thisRetrieve)
    return result.ok(users)
  },
})
