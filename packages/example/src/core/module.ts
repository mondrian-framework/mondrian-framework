import { Context, LoggedUserContext, posts, users } from '.'
import { InvalidJwtError, UnauthorizedAccess } from './errors'
import { Post } from './post'
import { User } from './user'
import { model, path, security } from '@mondrian-framework/model'
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
  version: process.env.MODULE_NAME ?? '0.0.0',
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
      if (userId) {
        const policies = buildUserPolicies(userId)
        const f = functions[functionName as keyof typeof functions]
        const res = security.checkPolicies({
          outputType: f.output,
          retrieve,
          policies,
          capabilities: f.retrieve,
          path: path.root,
        })
        if (!res.isOk) {
          throw new UnauthorizedAccess(res.error)
        }
      }
    }
    return context
  },
})

function buildUserPolicies(userId: number): security.Policy<model.Type>[] {
  return (
    security

      //User
      .of(User)
      .privateRead({
        selection: true,
        domain: { id: { equals: userId } },
      })
      .publicRead({ id: true, firstName: true, lastName: true })

      //Post
      .of(Post)
      .publicFilteredRead({
        selection: true,
        filter: { visibility: { equals: 'PRIVATE' }, author: { id: { equals: userId } } },
      })
      .publicFilteredRead({
        selection: true,
        filter: {
          visibility: { equals: 'FOLLOWERS' },
          author: { followers: { some: { follower: { id: { equals: userId } } } } },
        },
      })
      .publicFilteredRead({
        selection: true,
        filter: { visibility: { equals: 'PUBLIC' } },
      })
      .build()
  )
}
