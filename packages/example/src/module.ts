import m from '@mondrian/module'
import t from '@mondrian/model'
import types, { User } from './types'
import operations from './operations'

const db = new Map<string, any>()

const context = m.context(async (req) => ({ userId: req.headers.id }))

export default m.module({
  name: 'Jopla',
  types,
  operations,
  configuration: t.object({
    STARTING_ID: t.number(),
    MONGODB_URL: t.string(),
  }),
  context,
  resolvers: {
    queries: {
      user: {
        f: async ({ input, context, fields }) => {
          const user = input.id ? (db.get(input.id) as User | null) : null
          if (!user) {
            return undefined
          }
          return user
        },
      },
      users: {
        f: async ({ input, context, fields }) => {
          const users = [...db.values()]
          return users
        },
      },
    },
    mutations: {
      register: {
        f: async ({ input, fields, context, configuration }) => {
          if (db.size >= 20000) {
            throw new Error('Maximum db size')
          }
          const id = (db.size + configuration.STARTING_ID).toString()
          const user: User = { id, ...input, registeredAt: new Date() }
          db.set(id, user)
          return user
        },
      },
    },
  },
})
