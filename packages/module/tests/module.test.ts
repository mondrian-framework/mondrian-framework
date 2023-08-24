import { module, functions, sdk } from '../src'
import { types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

test('Real example', async () => {
  ///Types
  const User = () =>
    types.object({
      email: types.string(),
      password: types.string(),
      firstname: types.string().optional(),
      lastname: types.string().optional(),
      friend: types.optional(User).reference(),
    })
  type User = types.Infer<typeof User>
  const LoginInput = types.pick(User, { email: true, password: true }, types.Mutability.Immutable, {
    name: 'LoginInput',
  })
  const LoginOutput = types.object({ jwt: types.string(), user: User }).nullable().setName('LoginOuput')

  //Functions
  type SharedContext = {
    db: {
      findUser(filter: { email: string }): User | undefined
      updateUser(user: User): User
    }
  }

  const login = functions.withContext<SharedContext & { from?: string }>().build({
    input: LoginInput,
    output: LoginOutput,
    apply: async ({ input, context: { db }, log }) => {
      const user = db.findUser({ email: input.email })
      if (!user || user.password !== input.password) {
        log(`Invalid email or password: ${input.email}`, 'warn')
        return null
      }
      log(`Logged in: ${input.email}`, 'log')
      return { jwt: user.email, user }
    },
    after: [
      {
        name: 'Hide password',
        apply: ({ result }) => {
          if (result?.user?.password) {
            return { ...result, user: { ...result.user, password: '****' } }
          }
          return result
        },
      },
    ],
    options: { namespace: 'authentication' },
  })
  const register = functions.withContext<SharedContext & { from?: string }>().build({
    input: LoginInput,
    output: types.nullable(User),
    apply: async ({ input, context: { db }, log }) => {
      const user = db.findUser({ email: input.email })
      if (user) {
        log(`Double register: ${input.email}`, 'error')
        return null
      }
      log(`Registered: ${input.email}`)
      return db.updateUser(input)
    },
    before: [
      {
        name: 'Avoid weak passwords',
        apply: ({ args }) => {
          if (args.input.password === '123') {
            throw new Error('Weak password')
          }
          return args
        },
      },
    ],
    options: { namespace: 'authentication' },
  })

  const completeProfile = functions.withContext<SharedContext & { authenticatedUser?: { email: string } }>().build({
    input: types.object({ firstname: types.string(), lastname: types.string() }),
    output: User,
    apply: async ({ input, context: { db, authenticatedUser } }) => {
      if (!authenticatedUser) {
        throw new Error('Unauthorized')
      }
      const user = db.findUser({ email: authenticatedUser.email })
      if (!user) {
        throw new Error('Unrechable')
      }
      return db.updateUser({ ...user, ...input })
    },
    options: { namespace: 'business-logic' },
  })
  const memory = new Map<string, User>()
  const db: SharedContext['db'] = {
    updateUser(user) {
      memory.set(user.email, user)
      return user
    },
    findUser(user) {
      return memory.get(user.email)
    },
  }

  const m = module.build({
    name: 'test',
    version: '1.0.0',
    options: { checks: { maxProjectionDepth: 2 } },
    functions: { login, register, completeProfile },
    context: async ({ ip, authorization }: { ip: string; authorization: string | undefined }) => {
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

  const client = sdk.withMetadata<{ ip?: string; authorization?: string }>().build({
    module: m,
    context: async ({ metadata }) => {
      return { ip: metadata?.ip ?? 'local', authorization: metadata?.authorization }
    },
  })
  await expect(
    async () => await client.functions.register({ email: 'admin@domain.com', password: '123' }),
  ).rejects.toThrow()
  await client.functions.register({ email: 'admin@domain.com', password: '1234' })
  const failedRegisterResult = await client.functions.register({ email: 'admin@domain.com', password: '1234' })
  expect(failedRegisterResult).toBeNull()
  const failedLoginResult = await client.functions.login({ email: 'admin@domain.com', password: '4321' })
  expect(failedLoginResult).toBeNull()
  const loginResult = await client.functions.login({ email: 'admin@domain.com', password: '1234' })
  expect(loginResult).toEqual({ user: { email: 'admin@domain.com', password: '****' }, jwt: 'admin@domain.com' })
  await expect(
    async () => await client.functions.completeProfile({ firstname: 'Pieter', lastname: 'Mondriaan' }),
  ).rejects.toThrowError('Unauthorized')
  expect(
    async () =>
      await client.functions.completeProfile(
        { firstname: 'Pieter', lastname: 'Mondriaan' },
        { metadata: { authorization: 'wrong' } },
      ),
  ).rejects.toThrow()
  if (loginResult) {
    const authClient = client.withMetadata({ authorization: loginResult.jwt })
    const myUser = await authClient.functions.completeProfile(
      { firstname: 'Pieter', lastname: 'Mondriaan' },
      { operationId: '123' },
    )
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
    const input = types.number().setName('Input')
    const output = types.union({ n, v: input.setName('V') })

    const f = functions.build({
      input,
      output,
      apply: () => {
        throw 'Unreachable'
      },
    })
    expect(() =>
      module.build({
        name: 'test',
        version: '1.0.0',
        functions: { f },
        context: async () => ({}),
      }),
    ).toThrowError(`Duplicated type name "Input"`)
  })
})

describe('Default middlewares', () => {
  test('Testing maximum projection depth and output type', async () => {
    const type = () => types.object({ type, value: types.string() }).optional()
    const dummy = functions.build({
      input: type,
      output: type,
      apply: async ({ input }) => {
        if (input?.value === 'wrong') {
          return {} //projection not respected sometimes!
        }
        return input
      },
    })
    const m = module.build({
      name: 'test',
      version: '1.0.0',
      functions: { dummy },
      options: {
        checks: { maxProjectionDepth: 2, output: 'throw' },
      },
      context: async () => ({}),
    })

    const client = sdk.build({
      module: m,
      async context() {
        return {}
      },
    })

    const result1 = await client.functions.dummy({ value: '123' })
    expect(result1).toEqual({ value: '123' })
    const result2 = await client.functions.dummy({ value: '123' }, { projection: { type: { type: true } } })
    expect(result2).toEqual({})
    expect(
      async () => await client.functions.dummy({ value: '123' }, { projection: { type: { type: { type: true } } } }),
    ).rejects.toThrowError('Max projection depth reached: requested projection have a depth of 3. The maximum is 2.')
    expect(async () => await client.functions.dummy({ value: 'wrong' })).rejects.toThrowError(
      'Invalid output: {"errors":[{"missingField":"value","path":{"fragments":[]}}]}',
    )
  })
})
