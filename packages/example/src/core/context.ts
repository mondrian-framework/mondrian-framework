import { IdType } from './common/model'
import { PrismaClient } from '@prisma/client'

export type Context = { prisma: PrismaClient; ip: string }
export type LoggedUserContext = Context & { userId?: IdType }
