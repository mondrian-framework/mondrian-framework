import { IdType } from '../interface/common/model'
import { unauthorized } from '../interface/common/model'
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'
import { PrismaClient } from '@prisma/client'
import jsonwebtoken from 'jsonwebtoken'

export const authProvider = provider.build({
  errors: { unauthorized },
  apply: async ({ authorization }: { authorization: string | undefined }) => {
    if (authorization) {
      const secret = process.env.JWT_SECRET ?? 'secret'
      const rawJwt = authorization.replace('Bearer ', '')
      try {
        const jwt = jsonwebtoken.verify(rawJwt, secret, { complete: true })
        if (typeof jwt.payload === 'object' && jwt.payload.sub) {
          const userId: IdType = Number(jwt.payload.sub)
          return result.ok({ userId })
        }
      } catch {
        return result.fail(unauthorized.error({ reason: 'InvalidJwt' }))
      }
    }
    return result.fail(unauthorized.error({ reason: 'AuthorizationMissing' }))
  },
})

export const optionalAuthProvider = provider.build({
  apply: async (input: { authorization: string | undefined }) => {
    const auth = await authProvider.apply(input)
    const res = auth.recover(() => ({ userId: undefined }))
    return result.ok(res)
  },
})

const prismaSingleton = new PrismaClient()
export const dbProvider = provider.build({
  apply: async () => {
    return result.ok({ prisma: prismaSingleton })
  },
})

export const localizationProvider = provider.build({
  apply: async ({ ip }: { ip: string }) => {
    return result.ok({ ip })
  },
})
