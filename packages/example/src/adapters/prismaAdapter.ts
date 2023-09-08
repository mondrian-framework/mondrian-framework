import { Context } from '../core'
import { PrismaClient } from '@prisma/client'

export function prismaAdapter(client: PrismaClient): Context {
  return {
    async addUser(email, password, firstName, lastName, metadata) {
      const data = { email, password, firstName, lastName, metadata }
      return client.user.create({ data })
    },

    async findUser(email, password) {
      const result = await client.user.findFirst({ where: { email, password }, select: { id: true } })
      return result?.id ?? undefined
    },

    async updateLoginTime(id, loginTime) {
      const metadata = { update: { lastLogin: loginTime } }
      const result = await client.user.update({ where: { id }, data: { metadata } })
      return result
    },
  }
}
