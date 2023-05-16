import m from '@mondrian/module'
import { Types, User } from './types'

type SharedContext = { startingId: number; db: Map<string, any> }
const f = m.functionBuilder<Types, SharedContext>()

const user = f(
  {
    input: 'UserFilter',
    output: 'UserOutput',
    async apply({ input, context, fields, operationId }) {
      const user = input.id ? (context.db.get(input.id) as User | null) : null
      if (!user) {
        return undefined
      }
      return user
    },
  },
  {
    description: 'Get a user',
  },
)
const users = f({
  input: 'UserFilter',
  output: 'UserOutputs',
  async apply({ input, context, fields, operationId }) {
    return [...context.db.values()]
  },
})
const register = f({
  input: 'UserInput',
  output: 'User',
  async apply({ input, context, fields, operationId }) {
    if (context.db.size >= 20000) {
      throw new Error('Maximum db size')
    }
    const id = (context.db.size + context.startingId).toString()
    const user: Partial<User> =
      input.type === 'PROFESSIONAL'
        ? { id, ...input, registeredAt: new Date() }
        : { id, ...input, registeredAt: new Date(), referrerId: id }
    context.db.set(id, user)
    return user
  },
})

export const functions = m.functions({ users, user, register })
export type Functions = typeof functions
