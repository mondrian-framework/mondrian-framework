import { policies, posts, users } from '.'
import { module as moduleInterface } from '../interface'
import { result } from '@mondrian-framework/model'
import { PrismaClient } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

//Prisma singleton
const prisma = new PrismaClient()

//Instance of this module
export const module = moduleInterface.implement({
  functions: {
    ...posts,
    ...users,
  },
  options: {
    maxSelectionDepth: 4,
    checkOutputType: 'throw',
    opentelemetry: true,
  },
  async context({ authorization, ip }: { authorization?: string; ip: string }) {
    if (authorization) {
      const secret = process.env.JWT_SECRET ?? 'secret'
      const rawJwt = authorization.replace('Bearer ', '')
      try {
        const jwt = jsonwebtoken.verify(rawJwt, secret, { complete: true })
        if (typeof jwt.payload === 'object' && jwt.payload.sub) {
          const userId = Number(jwt.payload.sub)
          return result.ok({ prisma, ip, userId })
        }
      } catch {
        return result.fail({ invalidJwt: rawJwt })
      }
    }
    return result.ok({ prisma, ip })
  },
  policies(context) {
    if (context.userId != null) {
      return policies.loggedUser(context.userId)
    } else {
      return policies.guest
    }
  },
})
