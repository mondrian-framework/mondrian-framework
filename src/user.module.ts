import m from './mondrian' //from '@twinlogix/mondrian/core'

const UserId = m.string()
type UserId = m.Infer<typeof UserId>
const DateTime = m.string()
type DateTime = m.Infer<typeof DateTime>
//TYPES
const Id = m.string()
type Id = m.Infer<typeof Id>
const User = () =>
  m.object({
    id: UserId,
    username: m.optional(m.optional(m.string())),
    creationDate: DateTime,
    likes: m.number(),
    embedded: m.object({
      n: m.number(),
    }),
    friend: User,
    embeddedWithRecursion: m.object({
      user: m.array(User),
    }),
    // type: m.literal(['PROFESSIONAL', 'CUSTOMER']),
    /*username: m.string(),
    live: m.boolean(),
    metadata: m.unknown(),
    friends: m.optional(m.array(m.union([User, m.nill()]))),
    asd: m.custom({ decode: () => ({ asd: new Date() } as const) }),*/
  })
type User = m.Infer<typeof User>
const UserInput = m.object({
  username: m.string(),
  password: m.string(),
})
type UserInput = m.Infer<typeof UserInput>

const types = m.types({ Id, User, UserInput })

//OPERATIONS
const register = m.operation({
  types,
  input: 'UserInput',
  output: 'User',
})
const getUser = m.operation({
  types,
  input: 'Id',
  output: 'User',
  options: {
    rest: { path: '/user/:id' },
    graphql: { inputName: 'id' },
  },
})
const operations = m.operations({ mutations: { register }, queries: { user: getUser } })
const context = m.context(async (req) => ({ userId: req.headers.id }))

const db = new Map<string, { id: string; username: string }>()
db.set('0', { id: '0', username: 'Default' })
const testModule = m.module({
  name: 'Test',
  types,
  operations,
  context,
  resolvers: {
    queries: {
      user: {
        f: async ({ input, context }) => {
          console.log(context)
          const user = db.get(input)
          if (!user) {
            throw 'NOT FOUND'
          }
          return user
        },
      },
    },
    mutations: {
      register: {
        f: async ({ input, fields, context }) => {
          const id = db.size.toString()
          db.set(id, { id, username: input.username })
          return { id, username: input.username, active: 'YES' }
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
