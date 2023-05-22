import m from '@mondrian/module'
import { Types, User } from './types'
import { PrismaClient } from '@prisma/client'

type SharedContext = { startingId: number; prisma: PrismaClient }
const f = m.functionBuilder<Types, SharedContext>()

const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, fields, operationId }) {
    const users = await context.prisma.user.findMany({
      where: input,
    })
    return users
  },
})
const register = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, fields, operationId }) {
    const user = await context.prisma.user.create({ data: input })
    const jwt = 'todo'
    return { user, jwt }
  },
})
const checkPost = f({
  input: 'Void',
  output: 'CheckPostOutput',
  async apply({ input, context, fields, operationId }) {
    return { blockedPosts: [], passedPosts: [] }
  },
})

export const functions = m.functions({ users, register, checkPost })
export type Functions = typeof functions
