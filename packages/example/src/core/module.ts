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
  version: process.env.MODULE_VERSION ?? '0.0.0',
  functions,
  options: {
    maxSelectionDepth: 4,
    checkOutputType: 'throw',
    opentelemetryInstrumentation: true,
  },
  context: async ({ authorization, ip }: { authorization?: string; ip: string }, { functionName, retrieve }) => {
    let context: Context | LoggedUserContext = { prisma, ip }
    if (authorization) {
      const secret = process.env.JWT_SECRET ?? 'secret'
      const rawJwt = authorization.replace('Bearer ', '')
      let userId: number | null = null
      try {
        const jwt = jsonwebtoken.verify(rawJwt, secret, { complete: true })
        if (typeof jwt.payload === 'object' && jwt.payload.sub) {
          userId = Number(jwt.payload.sub)
          context = { ...context, userId }
        }
      } catch {
        throw new InvalidJwtError(rawJwt)
      }
    }
    return context
  },
  policies(context) {
    if (context.userId != null) {
      return policies.user(context.userId)
    } else {
      return policies.guest
    }
  },
})
