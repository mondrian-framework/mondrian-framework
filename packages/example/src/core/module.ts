import { Context, LoggedUserContext, policies, posts, users } from '.'
import { module as moduleInterface } from '../interface'
import { InvalidJwtError } from './errors'
import { PrismaClient } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

//Prisma singleton
const prisma = new PrismaClient()

//Instance of this module
export const module = moduleInterface.implement({
  functions: {
    ...users,
    ...posts,
  },
  options: {
    maxSelectionDepth: 4,
    checkOutputType: 'throw',
    opentelemetry: true,
  },
  async context({ authorization, ip }: { authorization?: string; ip: string }): Promise<Context | LoggedUserContext> {
    if (authorization) {
      const secret = process.env.JWT_SECRET ?? 'secret'
      const rawJwt = authorization.replace('Bearer ', '')
      try {
        const jwt = jsonwebtoken.verify(rawJwt, secret, { complete: true })
        if (typeof jwt.payload === 'object' && jwt.payload.sub) {
          const userId = Number(jwt.payload.sub)
          return { prisma, ip, userId }
        }
      } catch {
        throw new InvalidJwtError(rawJwt)
      }
    }
    return { prisma, ip }
  },
  policies(context) {
    if (context.userId != null) {
      return policies.loggedUser(context.userId)
    } else {
      return policies.guest
    }
  },
})
