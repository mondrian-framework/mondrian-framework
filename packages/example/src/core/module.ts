import { Context, LoggedUserContext, policies, posts, users } from '.'
import { InvalidJwtError } from './errors'
import { module } from '@mondrian-framework/module'
import { PrismaClient } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

//Merging all functions under a object
export type Functions = typeof functions
export const functions = {
  ...users.actions,
  ...posts.actions,
}

//Prisma singleton
const prisma = new PrismaClient()

//Instance of this module
export const instance = module.build({
  name: process.env.MODULE_NAME ?? '???',
  functions,
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
