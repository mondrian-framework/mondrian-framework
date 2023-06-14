import { types } from '../types'
import f from './functions.commons'
import { subProjection } from '@mondrian-framework/model'
import { PrismaUtils } from '@mondrian-framework/prisma'
import { Prisma } from '@prisma/client'
import jwt from 'jsonwebtoken'

export const register = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, projection }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(types.User, userSelect)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const login = f({
  input: 'LoginInput',
  output: 'LoginOutput',
  async apply({ input, context, projection }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(types.User, userSelect, {
      posts: { take: 1, select: { id: true } },
      id: true,
    })
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
})

export const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, projection }) {
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(types.User, projection)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
})

export const test = f({
  input: 'TestInput',
  output: 'TestOutput',
  async apply({ input, context, projection }) {
    return JSON.stringify(input)
  },
})
