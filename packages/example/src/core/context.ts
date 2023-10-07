import { IdType } from './common/model'
import { PrismaClient } from '@prisma/client'

export type Context = { prisma: PrismaClient }
export type LoggedUserContext = { prisma: PrismaClient; userId?: IdType }
