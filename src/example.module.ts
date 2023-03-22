import { randomUUID } from 'crypto'
import { module, operation, operations, type, types } from './mondrian' //from '@twinlogix/mondrian/core'

//TYPES
const id = () => type({ id: { type: 'string' } })
const user = () =>
  type({
    id: { type: 'string' },
    username: { type: 'string' },
    posts: { type: 'object', schema: post },
  })
const userInput = () =>
  type({
    username: { type: 'string' },
    password: { type: 'string' },
  })
const post = () =>
  type({
    id: { type: 'string' },
    content: { type: 'string' },
    creator: { type: 'object', schema: user },
  })

//OPERATIONS
const register = operation({
  type: 'mutation',
  input: userInput,
  output: user,
})
const getUser = operation({
  type: 'query',
  input: id,
  output: user,
  options: {
    rest: { path: '/user/:id' },
  },
})

const db = new Map<string, { id: string; username: string }>()
const m = module({
  name: 'Test',
  types: types({ id, user, userInput }),
  operations: operations({ register, user: getUser }),
  context: async (req) => {
    const context: { userId: string | null } = {
      userId: req.headers['userId'] as string,
    }
    return context
  },
  resolvers: {
    register: {
      f: async ({ input, fields, context }) => {
        const id = randomUUID()
        db.set(id, { id, username: input.username })
        return {
          id: id,
          username: input.username,
        }
      },
    },
    user: {
      f: async ({ input }) => {
        const user = db.get(input.id)
        if (!user) {
          throw 'NOT FOUND'
        }
        return user 
      },
    },
  },
})

m.start({
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
