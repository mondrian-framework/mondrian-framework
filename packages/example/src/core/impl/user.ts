import { module } from '../../interface'
import { User } from '../../interface/user'
import { slotProvider } from '../../rate-limiter'
import { authProvider, dbProvider, localizationProvider } from '../providers'
import { retrieve } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

export const login = module.functions.login
  .withProviders({ db: dbProvider, localization: localizationProvider })
  .implement({
    body: async ({ input, logger, db: { prisma }, errors, ok }) => {
      const { email, password } = input
      const loggedUser = await prisma.user.findFirst({ where: { email, password }, select: { id: true } })
      if (!loggedUser) {
        logger.logWarn(`${input.email} failed login`)
        return errors.invalidLogin()
      }
      await prisma.user.update({
        where: { id: loggedUser.id },
        data: { loginAt: new Date() },
      })
      const secret = process.env.JWT_SECRET ?? 'secret'
      const jwt = jsonwebtoken.sign({ sub: loggedUser.id }, secret)
      return ok(jwt)
    },
    middlewares: [
      rateLimiter.build({
        key: ({ input }) => input.email,
        rate: '10 requests in 1 minute',
        onLimit: async ({ errors }) => {
          //Improvement: warn the user, maybe block the account
          return errors.tooManyRequests({ limitedBy: 'email' })
        },
        slotProvider,
      }),
      rateLimiter.build({
        key: ({ localization: { ip } }) => ip,
        rate: '10000 requests in 1 hours',
        onLimit: async ({ errors }) => {
          return errors.tooManyRequests({ limitedBy: 'ip' })
        },
        slotProvider,
      }),
    ],
  })

export const register = module.functions.register.withProviders({ db: dbProvider }).implement({
  body: async ({ input, db: { prisma }, ok, errors }) => {
    try {
      const user = await prisma.user.create({
        data: {
          ...input,
          registeredAt: new Date(),
          loginAt: new Date(),
        },
      })
      return ok(user)
    } catch {
      //unique index fail
      return errors.emailAlreadyTaken()
    }
  },
})

export const follow = module.functions.follow.withProviders({ auth: authProvider, db: dbProvider }).implement({
  body: async ({ input, retrieve: thisRetrieve, auth: { userId }, db: { prisma }, errors, ok }) => {
    if (input.userId === userId || (await prisma.user.count({ where: { id: input.userId } })) === 0) {
      return errors.userNotExists()
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
    return ok(user)
  },
})

export const getUsers = module.functions.getUsers.withProviders({ auth: authProvider, db: dbProvider }).implement({
  body: async ({ retrieve: thisRetrieve, db: { prisma }, ok }) => {
    const users = await prisma.user.findMany(thisRetrieve)
    return ok(users)
  },
})
