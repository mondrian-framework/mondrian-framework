import { IdType } from '../interface/common/model'
import { authenticationFailed } from '../interface/common/model'
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'
import { PrismaClient } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

const prismaSingleton = new PrismaClient()
export const dbProvider = provider.build({
  body: async () => {
    return result.ok({ prisma: prismaSingleton })
  },
})

type AuthResult = { userId?: number } | undefined
export const optionalAuthProvider = provider.build({
  body: async ({ authorization }: { authorization: string | undefined }) => {
    if (authorization) {
      const secret = process.env.JWT_SECRET ?? 'secret'
      const rawJwt = authorization.replace('Bearer ', '')
      try {
        const jwt = jsonwebtoken.verify(rawJwt, secret, { complete: true })
        if (typeof jwt.payload === 'object' && jwt.payload.sub) {
          const userId: IdType = Number(jwt.payload.sub)
          return result.ok<AuthResult>({ userId })
        }
      } catch {
        return result.ok<AuthResult>({ userId: undefined })
      }
    }
    return result.ok()
  },
})

export const authProvider = provider.use({ providers: { auth: optionalAuthProvider } }).build({
  errors: { authenticationFailed },
  body: async (_input: {}, args) => {
    if (args.auth?.userId != null) {
      return result.ok({ userId: args.auth.userId })
    } else if (args.auth) {
      return result.fail({ authenticationFailed: { reason: 'InvalidJwt' } })
    } else {
      return result.fail({ authenticationFailed: { reason: 'AuthorizationMissing' } })
    }
  },
})
