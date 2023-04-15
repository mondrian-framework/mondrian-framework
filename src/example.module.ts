import m from './mondrian' //from '@twinlogix/mondrian/core'

//Ideas
// - http: concept of default projection

const Id = m.custom({
  name: 'ID',
  opts: {
    decode(input) {
      if (typeof input !== 'string') {
        throw new Error('Invalid ID type')
      }
      return input
    },
    encode(input) {
      return input
    },
    is(input) {
      return typeof input === 'string'
    },
  },
})
type Id = m.Infer<typeof Id>

const PostTag = m.literal(['A', 'B', 'C'])

const User = () =>
  m.object({
    id: Id,
    username: m.string(),
    password: m.string(),
    registeredAt: m.scalars.timestamp,
    posts: m.optional(m.array(Post)),
    taggedPosts: m.optional(m.array(Post)),
  })
type User = m.Infer<typeof User>

const Post = () =>
  m.object({
    id: Id,
    userId: Id,
    user: User,
    createdAt: m.scalars.timestamp,
    content: m.string(),
    tags: m.optional(m.array(PostTag)),
  })
type Post = m.Infer<typeof Post>

const UserInput = m.object({
  username: m.string(),
  password: m.string(),
})
type UserInput = m.Infer<typeof UserInput>
const UserFind = m.object({
  id: Id,
})
type UserFind = m.Infer<typeof UserFind>
const UserOutput = m.optional(User)
type UserOutput = m.Infer<typeof UserOutput>

const types = m.types({ Id, User, UserOutput, Post, UserFind, UserInput, PostTag })

//OPERATIONS
const register = m.operation({
  types,
  input: 'UserInput',
  output: 'User',
})
const getUser = m.operation({
  types,
  input: 'UserFind',
  output: 'UserOutput',
  options: {
    rest: { path: '/user/:id' },
    graphql: { inputName: 'id' },
  },
})
const operations = m.operations({ mutations: { register }, queries: { user: getUser } })
const context = m.context(async (req) => ({ userId: req.headers.id }))

const db = new Map<string, any>()
const testModule = m.module({
  name: 'Test',
  types,
  operations,
  context,
  resolvers: {
    queries: {
      user: {
        f: async ({ input, context }) => {
          const user = db.get(input.id)
          if (!user) {
            return null
          }
          return user
        },
      },
    },
    mutations: {
      register: {
        f: async ({ input, fields, context }) => {
          const id = db.size.toString()
          const user: User = { id, ...input, registeredAt: new Date() }
          db.set(id, user)
          return user
        },
      },
    },
  },
})

m.start(testModule, {
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
  grpc: {
    enabled: true,
    port: 4001,
    reflection: true,
  },
}).then(({ address, module }) => console.log(`Mondrian module "${module.name}" has started! ${address}`))

async function main() {
  const skd = m.sdk({
    module: testModule,
    defaultHeaders: {
      Authorization: 'api-key',
    },
  })
  const ins = await skd.mutation.register({
    input: { password: '1234', username: 'Mario' },
    fields: { id: true, username: true },
    headers: { id: '1234' },
  })
  console.log(ins)
  const result = await skd.query.user({
    input: { id: ins.id },
    fields: { id: true, username: true },
    headers: { id: '1234' },
  })
  console.log(result)
}

main().then(() => {})
