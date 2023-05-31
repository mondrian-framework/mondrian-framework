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
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, types.User)
    const user = await context.prisma.user.create({ data: input, select })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const login = f({
  input: 'LoginInput',
  output: 'LoginOutput',
  async apply({ input, context, projection }) {
    const userSelect = subProjection(projection, 'user')
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(userSelect, types.User, { posts: { take: 0 } })
    const user = await context.prisma.user.findFirst({ where: input, select })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
})

export const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, projection }) {
    const select = PrismaUtils.projectionToSelection<Prisma.UserSelect>(projection, types.User)
    const users = await context.prisma.user.findMany({ where: input, select })
    return users
  },
})

export const asd = f({
  input: 'Void',
  output: 'Asd',
  async apply({ input, context, projection }) {
    console.log(projection)
    return [{ a: 'a', value: 'asd' }, { a: 'b' }]
  },
})
