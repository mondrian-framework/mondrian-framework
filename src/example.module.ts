import m from './mondrian' //from '@twinlogix/mondrian/core'

const Id = m.custom({
  name: 'ID',
  decode(input) {
    if (typeof input !== 'string') {
      return { pass: false, errors: [{ path: '', value: input, error: 'ID expected' }] }
    }
    if (input.length === 0) {
      return { pass: false, errors: [{ path: '', value: input, error: 'Empty ID is not valid' }] }
    }
    return { pass: true, value: input }
  },
  encode(input) {
    return input
  },
  is(input) {
    return typeof input === 'string' && input.length > 0
  },
})
type Id = m.Infer<typeof Id>

const PostTag = m.enumarator(['A', 'B', 'C'])
type PostTag = m.Infer<typeof PostTag>

const User = () =>
  m.object({
    id: Id,
    username: m.string(),
    password: m.string(),
    registeredAt: m.timestamp(),
    posts: m.optional(m.array(Post)),
    taggedPosts: m.optional(m.array(Post)),
  })
type User = m.Infer<typeof User>
const Post = () =>
  m.object({
    id: Id,
    userId: Id,
    //user: User,
    createdAt: m.datetime(),
    content: m.string(),
    tags: m.optional(m.array(PostTag)),
  })
type Post = m.Infer<typeof Post>
const UserInput = m.object({
  username: m.string(),
  password: m.string(),
})
type UserInput = m.Infer<typeof UserInput>
const UserFind = Id //m.object({ id: Id })
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
          const user = db.get(input)
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
  /*grpc: {
    enabled: true,
    port: 4001,
    reflection: true,
  },*/
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
    input: ins.id,
    fields: { id: true, username: true },
    headers: { id: '1234' },
  })
  console.log(result)
}

main().then(() => {})
