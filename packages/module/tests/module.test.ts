import { module, sdk } from '../src'
import { types } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

test('Whole module', async () => {
  ///Types
  const User = () =>
    types.object({
      email: types.string(),
      password: types.string(),
      firstname: types.string().optional(),
      lastname: types.string().optional(),
    })
  type User = types.Infer<typeof User>
  const LoginInput = types.pick(User, { email: true, password: true }, 'immutable', { name: 'LoginInput' })
  const LoginOutput = types.object({ jwt: types.string(), user: User }).nullable().setName('LoginOuput')

  //Functions
  type SharedContext = {
    db: {
      findUser(filter: { email: string }): User | undefined
      updateUser(user: User): User
    }
  }
  const authentication = module.functionBuilder<SharedContext & { from?: string }>({ namespace: 'authentication' })
  const login = authentication({
    input: LoginInput,
    output: LoginOutput,
    async apply({ input, context: { db }, log }) {
      const user = db.findUser({ email: input.email })
      if (!user || user.password !== input.password) {
        log(`Invalid email or password: ${input.email}`, 'warn')
        return null
      }
      log(`Logged in: ${input.email}`, 'log')
      return { jwt: user.email, user }
    },
  })
  const register = authentication({
    input: LoginInput,
    output: types.nullable(User),
    async apply({ input, context: { db }, log }) {
      const user = db.findUser({ email: input.email })
      if (user) {
        log(`Double register: ${input.email}`, 'error')
        return null
      }
      log(`Registered: ${input.email}`)
      return db.updateUser(input)
    },
  })

  const businessLogic = module.functionBuilder<SharedContext & { authenticatedUser?: { email: string } }>({
    namespace: 'business-logic',
  })
  const completeProfile = businessLogic({
    input: types.object({ firstname: types.string(), lastname: types.string() }),
    output: User,
    async apply({ input, context: { db, authenticatedUser } }) {
      if (!authenticatedUser) {
        throw new Error('Unauthorized')
      }
      const user = db.findUser({ email: authenticatedUser.email })
      if (!user) {
        throw new Error('Unrechable')
      }
      return db.updateUser({ ...user, ...input })
    },
  })

  const functions = module.functions({ login, register, completeProfile })
  const memory = new Map<string, User>()
  const m = module.define<{ ip: string; authorization: string | undefined }>()({
    name: 'Test',
    version: '1.0.0',
    functions: {
      definitions: functions,
    },
    options: {
      checks: {
        maxProjectionDepth: 2,
      },
    },
    async context({ ip, authorization }) {
      const db: SharedContext['db'] = {
        updateUser(user) {
          memory.set(user.email, user)
          return user
        },
        findUser(user) {
          return memory.get(user.email)
        },
      }
      if (authorization != null) {
        //dummy auth
        const user = db.findUser({ email: authorization })
        if (user) {
          return { from: ip, authenticatedUser: { email: user.email }, db }
        } else {
          throw `Invalid authorization`
        }
      }
      return { from: ip, db }
    },
  })

  const client = sdk.fromModule<{ ip?: string; authorization?: string }>()({
    module: m,
    async context({ metadata }) {
      return { ip: metadata?.ip ?? 'local', authorization: metadata?.authorization }
    },
  })

  await client.functions.register({ email: 'admin@domain.com', password: '1234' })
  const failedRegisterResult = await client.functions.register({ email: 'admin@domain.com', password: '1234' })
  expect(failedRegisterResult).toBeNull()
  const failedLoginResult = await client.functions.login({ email: 'admin@domain.com', password: '4321' })
  expect(failedLoginResult).toBeNull()
  const loginResult = await client.functions.login({ email: 'admin@domain.com', password: '1234' })
  expect(loginResult).not.toBeNull()
  try {
    await client.functions.completeProfile({ firstname: 'Pieter', lastname: 'Mondriaan' })
  } catch (error) {
    expect(error instanceof Error).toBe(true)
  }
  try {
    await client.functions.completeProfile(
      { firstname: 'Pieter', lastname: 'Mondriaan' },
      { metadata: { authorization: 'wrong' } },
    )
  } catch (error) {
    expect(error).toBe(`Invalid authorization`)
  }
  if (loginResult) {
    const authClient = client.with({ authorization: loginResult.jwt })
    const myUser = await authClient.functions.completeProfile({ firstname: 'Pieter', lastname: 'Mondriaan' })
    expect(myUser).toEqual({
      email: 'admin@domain.com',
      password: '1234',
      firstname: 'Pieter',
      lastname: 'Mondriaan',
    })
  }
})
