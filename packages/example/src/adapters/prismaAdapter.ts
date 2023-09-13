import { Context, posts } from '../core'
import { utils } from '@mondrian-framework/prisma'
import { Prisma, PrismaClient } from '@prisma/client'

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

    async doesUserExist(id) {
      try {
        const result = await client.user.findFirst({ where: { id }, select: { id: true } })
        return result?.id ? true : false
      } catch {
        return false
      }
    },

    async addPost(title, content, publishedAt, authorId) {
      const data = { title, content, publishedAt, authorId }
      return client.post.create({ data })
    },

    async findPostsByAuthor(authorId, projection) {
      const select = utils.projectionToSelection<Prisma.PostSelect>(posts.post().array(), projection)
      console.log('projection:', projection)
      console.log('select:', select)
      const result = await client.post.findMany({ where: { authorId }, select })
      return result
    },
  }
}
