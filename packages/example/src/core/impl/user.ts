import { module } from '../../interface'
import { User } from '../../interface/user'
import { store } from '../../rate-limiter'
import { rateLimitByIpGuard } from '../guards'
import { authProvider, dbProvider } from '../providers'
import { result } from '@mondrian-framework/model'
import { retrieve } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { Prisma } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

const rateLimitByEmailProvider = rateLimiter.buildProvider({
  rate: '10 requests in 1 minute',
  store,
})

export const login = module.functions.login
  .use({
    providers: { db: dbProvider, rateLimiterByEmail: rateLimitByEmailProvider },
    guards: { rateLimitByIpGuard },
  })
  .implement({
    async body({ input, logger, db: { prisma }, rateLimiterByEmail }) {
      const { email, password } = input
      if (rateLimiterByEmail.check(email) === 'rate-limited') {
        return result.fail({ tooManyRequests: { limitedBy: 'email' } })
      }
      const loggedUser = await prisma.user.findFirst({ where: { email, password }, select: { id: true } })
      if (!loggedUser) {
        logger.logWarn(`${input.email} failed login`)
        rateLimiterByEmail.apply(email)
        return result.fail({ invalidLogin: {} })
      }
      await prisma.user.update({
        where: { id: loggedUser.id },
        data: { loginAt: new Date() },
      })
      const secret = process.env.JWT_SECRET ?? 'secret'
      const jwt = jsonwebtoken.sign({ sub: loggedUser.id }, secret)
      return result.ok(jwt)
    },
  })

export const register = module.functions.register.use({ providers: { db: dbProvider } }).implement({
  async body({ input, db: { prisma } }) {
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
      return result.fail({ emailAlreadyTaken: {} })
    }
  },
})

export const follow = module.functions.follow.use({ providers: { auth: authProvider, db: dbProvider } }).implement({
  async body({ input, retrieve: thisRetrieve, auth: { userId }, db: { prisma } }) {
    if (input.userId === userId || (await prisma.user.count({ where: { id: input.userId } })) === 0) {
      return result.fail({ userNotExists: {} })
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

export const getUsers = module.functions.getUsers.use({ providers: { auth: authProvider, db: dbProvider } }).implement({
  async body({ retrieve: thisRetrieve, db: { prisma } }) {
    const users = await prisma.user.findMany(thisRetrieve)
    return result.ok(users)
  },
})
