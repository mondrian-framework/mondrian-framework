import { PrismaClient } from '@prisma/client'
import { Types } from '../types'
import m from '@mondrian/module'

export type JwtData = { userId: string }
type SharedContext = { jwt?: JwtData; prisma: PrismaClient }
export default m.functionBuilder<Types, SharedContext>()
