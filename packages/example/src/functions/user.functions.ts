import jwt from 'jsonwebtoken'
import f from './functions.commons'
import { Prisma } from '@prisma/client'
import { types } from '../types'
import { PrismaUtils } from '@mondrian/prisma'
import { subProjection } from '@mondrian/model'

export const oldRegister = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, projection, operationId }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, types.User)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const register = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, projection, operationId }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, types.User)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const login = f({
  input: 'LoginInput',
  output: 'LoginOutput',
  async apply({ input, context, projection, operationId }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, types.User, { posts: { take: 2 } })
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
})

export const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, projection, operationId }) {
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(projection, types.User)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
})
