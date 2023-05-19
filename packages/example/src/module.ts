import m from '@mondrian/module'
import { types, Types } from './types'
import { functions, Functions } from './functions'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export const module = m.module<Types, Functions, { token?: string }>({
  name: 'Jopla',
  types,
  functions,
  async context(input: { token?: string }) {
    return { prisma, startingId: 1 }
  },
})
