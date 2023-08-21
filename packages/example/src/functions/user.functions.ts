import { LoginInput, RegisterInput, User, UserFilter } from '../types/user.types'
import { SharedContext } from './functions.commons'
import { projection } from '@mondrian-framework/model'
import t from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { utils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'
import jwt from 'jsonwebtoken'

const func = functions.withContext<SharedContext>()

export const register = func.build({
  input: RegisterInput,
  output: t.object({ user: User, jwt: t.string() }).setName('RegisterOutput'),
  async apply({ input, context, projection: p }) {
    const userSelect = (projection.subProjection as any)(p ?? true, ['user']) //TODO: #49
    const select = utils.projectionToSelection<Prisma.UserSelect>(User, userSelect)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
  options: { namespace: 'authentication' },
})

export const login = func.build({
  input: LoginInput,
  output: t.object({ user: User, jwt: t.string() }).nullable().setName('LoginOutput'),
  async apply({ input, context, projection: p }) {
    const userSelect = (projection.subProjection as any)(p ?? true, ['user']) //TODO: #49
    const select = utils.projectionToSelection<Prisma.UserSelect>(User, userSelect, {
      posts: { take: 1, select: { id: true } },
      id: true,
    })
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
  options: { namespace: 'authentication' },
})

export const users = func.build({
  input: UserFilter,
  output: t.array(User).setName('Users'),
  async apply({ input, context, projection }) {
    const select = utils.projectionToSelection<Prisma.UserSelect>(User, projection)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
  options: { namespace: 'user' },
})
