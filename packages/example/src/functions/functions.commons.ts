import { PrismaClient } from '@prisma/client'
import { Types } from '../types'
import m from '@mondrian/module'

export type AuthInfo = { userId: number }
export type SharedContext = { auth?: AuthInfo; prisma: PrismaClient }
export default m.functionBuilder<Types, SharedContext>()
