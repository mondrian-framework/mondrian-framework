import { Context, posts, users } from '.'
import { InvalidJwtError } from './errors'
import { module } from '@mondrian-framework/module'
import { PrismaClient } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

export type Functions = typeof functions
export const functions = {
  ...users.actions,
  ...posts.actions,
}

const prisma = new PrismaClient()
export const instance = module.build({
  name: 'reddit',
  version: '2.0.0',
  functions,
  options: {
    maxSelectionDepth: 3,
    checkOutputType: 'throw',
    opentelemetryInstrumentation: true,
  },
  context: async ({ authorization, ip }: { authorization?: string; ip: string }) => {
    const context: Context = { prisma, ip }
    if (authorization) {
      const secret = process.env.JWT_SECRET ?? 'secret'
      try {
        const jwt = jsonwebtoken.verify(authorization.replace('Bearer ', ''), secret, { complete: true })
        if (typeof jwt.payload === 'object' && jwt.payload.sub) {
          return { ...context, userId: jwt.payload.sub }
        }
      } catch {
        throw new InvalidJwtError('Invalid jwt')
      }
    }
    return context
  },
})
