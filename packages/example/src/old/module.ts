// import { Functions, functions } from './functions'
// import { AuthInfo } from './functions/functions.commons'
// import { module } from '@mondrian-framework/module'
// import { PrismaClient } from '@prisma/client'
// import jwt from 'jsonwebtoken'//

// const prisma = new PrismaClient()//

// export const m = module.build<Functions, { jwt?: string }>({
//   name: 'reddit',
//   version: '5.0.1',
//   functions,
//   functionOptions: {
//     login: { authentication: 'NONE' },
//     checkPost: { authentication: 'NONE' },
//   },
//   options: {
//     checks: {
//       output: 'log',
//       maxProjectionDepth: 5,
//     },
//     opentelemetryInstrumentation: true,
//   },
//   authentication: { type: 'bearer', format: 'jwt' },
//   async context(input: { jwt?: string }) {
//     if (input.jwt) {
//       const auth = jwt.verify(input.jwt.replace('Bearer ', ''), 'shhhhh') as AuthInfo
//       return { prisma, auth }
//     }
//     return { prisma }
//   },
// })
