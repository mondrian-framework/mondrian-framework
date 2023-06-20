import { LoginInput, RegisterInput, User, UserFilter } from '../types/user.types'
import { SharedContext } from './functions.commons'
import a from '@mondrian-framework/advanced-types'
import { subProjection } from '@mondrian-framework/model'
import t from '@mondrian-framework/model'
import { functionBuilder } from '@mondrian-framework/module'
import { PrismaUtils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'
import jwt from 'jsonwebtoken'

const f = functionBuilder<SharedContext>({ namespace: 'user' })

export const register = f({
  input: RegisterInput,
  output: t.object({ user: User, jwt: a.JWT() }).named('RegisterOutput'),
  async apply({ input, context, projection }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(User, userSelect)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
  namespace: 'authentication',
})

export const login = f({
  input: t.named(LoginInput, 'LoginInput'),
  output: t.object({ user: User, jwt: a.JWT() }).nullable().named('LoginOutput'),
  async apply({ input, context, projection }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(User, userSelect, {
      posts: { take: 1, select: { id: true } },
      id: true,
    })
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
  namespace: 'authentication',
})

export const users = f({
  input: UserFilter,
  output: t.array(User).named('Users'),
  async apply({ input, context, projection }) {
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(User, projection)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
})
