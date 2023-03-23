import { randomUUID } from 'crypto'
import m from '.' //from '@twinlogix/mondrian/core'

//TYPES
const id = m.string()
const user = () => m.object({
  id: m.string(),
  username: m.string(),
  referrerUsers: m.optional(m.array(user)),
  creationDate: m.date(),
})
const userInput = m.object({
  username: m.string(),
  password: m.string(),
})


//OPERATIONS
const register = m.operation({
  type: 'mutation',
  input: userInput,
  output: user,
})
const getUser = m.operation({
  type: 'query',
  input: id,
  output: user,
  options: {
    rest: { path: '/user/:id' },
  },
})

const db = new Map<string, { id: string; username: string }>()
const mod = m.module({
  name: 'Test',
  types: m.types({ id, user, userInput }),
  operations: m.operations({ register, user: getUser }),
  context: async (req) => {
    const context: { userId: string | null } = {
      userId: req.headers['userId'] as string,
    }
    return context
  },
  resolvers: {
    register: {
      f: async ({ input, fields, context }) => {
        const id = db.size.toString()
        db.set(id, { id, username: input.username })
        return { id, username: input.username }
      },
    },
    user: {
      f: async ({ input }) => {
        const user = db.get(input)
        if (!user) {
          throw 'NOT FOUND'
        }
        return user
      },
    },
  },
})

mod.start({
  port: 4000,
  sanbox: {
    enabled: true,
  },
  graphql: {
    enabled: true,
    path: '/graphql',
  },
  http: {
    enabled: true,
    prefix: '/api',
  },
}).then(({ address, args }) => console.log(`Mondrian module "${args.name}" has started! ${address}`))
