import m from '@mondrian/module'
import { types, Types } from './types'
import { functions, Functions } from './functions'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { AuthInfo } from './functions/functions.commons'
const prisma = new PrismaClient()

export const module = m.module<Types, Functions, { jwt?: string }>({
  name: 'reddit',
  version: '5.0.1',
  types,
  functions: {
    definitions: functions,
    options: {
      login: { authentication: 'NONE' },
      checkPost: { authentication: 'NONE' },
    },
  },
  authentication: { type: 'bearer', format: 'jwt' },
  async context(input: { jwt?: string }) {
    if (input.jwt) {
      const auth = jwt.verify(input.jwt.replace('Bearer ', ''), 'shhhhh') as AuthInfo
      return { prisma, auth }
    }
    return { prisma }
  },
})
