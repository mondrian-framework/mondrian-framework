import { module, functions, sdk } from '../src'
import { Function } from '../src/functions'
import { ContextType } from '../src/module'
import { types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

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
  const authentication = functions
    .builder()
    .withContext<SharedContext & { from?: string }>({ namespace: 'authentication' })
  const login = authentication.build({
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
  const register = authentication.build({
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

  const businessLogic = functions.builder().withContext<SharedContext & { authenticatedUser?: { email: string } }>({
    namespace: 'business-logic',
  })
  const completeProfile = businessLogic.build({
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
  const memory = new Map<string, User>()
  const m = module
    .builder()
    .options({ checks: { maxProjectionDepth: 2 } })
    .functions({ definitions: { login, register, completeProfile } })
    .context(async ({ ip, authorization }: { ip: string; authorization: string | undefined }) => {
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
    })
    .build()

  const client = sdk
    .builder()
    .withMetadata<{ ip?: string; authorization?: string }>()
    .build({
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
  await expect(
    async () => await client.functions.completeProfile({ firstname: 'Pieter', lastname: 'Mondriaan' }),
  ).rejects.toThrow()
  expect(
    async () =>
      await client.functions.completeProfile(
        { firstname: 'Pieter', lastname: 'Mondriaan' },
        { metadata: { authorization: 'wrong' } },
      ),
  ).rejects.toThrow()
  if (loginResult) {
    const authClient = client.withMetadata({ authorization: loginResult.jwt })
    const myUser = await authClient.functions.completeProfile({ firstname: 'Pieter', lastname: 'Mondriaan' })
    expect(myUser).toEqual({
      email: 'admin@domain.com',
      password: '1234',
      firstname: 'Pieter',
      lastname: 'Mondriaan',
    })
  }
})

describe('Unique type name', () => {
  test('Two different type cannot have the same name', () => {
    const n = () => types.number().setName('Input')
    const v = types.number().setName('Input')
    const output = types.union({ n, v: v.setName('V') })

    const f = functions.builder().build({
      input: v,
      output: output,
      apply(args) {
        throw 'Unreachable'
      },
    })
    expect(() =>
      module
        .builder()
        .functions({ definitions: { f } })
        .context(async () => ({}))
        .build(),
    ).toThrowError(`Duplicated type name "Input"`)
  })
})
