import jwt from 'jsonwebtoken'
import f from './functions.commons'

export const register = f({
  input: 'RegisterInput',
  output: 'RegisterOutput',
  async apply({ input, context, fields, operationId }) {
    const user = await context.prisma.user.create({ data: input })
    return { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') }
  },
})

export const login = f({
  input: 'LoginInput',
  output: 'LoginOutput',
  async apply({ input, context, fields, operationId }) {
    const user = await context.prisma.user.findFirst({ where: input })
    return user ? { user, jwt: jwt.sign({ userId: user.id }, 'shhhhh') } : null
  },
})

export const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, fields, operationId }) {
    const users = await context.prisma.user.findMany({
      where: input,
    })
    return users
  },
})
