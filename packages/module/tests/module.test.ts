import { module, functions, sdk } from '../src'
import { result, types } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

test('Real example', async () => {
  ///Types
  const User = () =>
    types.object({
      email: types.string(),
      password: types.string(),
      firstname: types.string().optional(),
      lastname: types.string().optional(),
      friend: { virtual: types.optional(User) },
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
    error: types.union({ invalidUsernameOrPassword: types.string() }),
    body: async ({ input, context: { db }, logger }) => {
      const user = db.findUser({ email: input.email })
      if (!user || user.password !== input.password) {
        logger.logWarn(`Invalid email or password: ${input.email}`)
        return result.fail({ invalidUsernameOrPassword: input.email })
      }
      logger.logInfo(`Logged in: ${input.email}`)
      return result.ok({ jwt: user.email, user })
    },
    middlewares: [
      {
        name: 'Hide password',
        apply: async (args, next) => {
          const res = await next(args)
          if (res.isOk && res.value?.user?.password) {
            return result.ok({ ...res.value, user: { ...res.value.user, password: '****' } })
          }
          return res
        },
      },
    ],
    options: { namespace: 'authentication' },
  })

  const register = functions.withContext<SharedContext & { from?: string }>().build({
    input: LoginInput,
    output: User().nullable(),
    error: types.union({ weakPassword: types.string(), doubleRegister: types.string() }),
    body: async ({ input, context: { db }, logger }) => {
      const user = db.findUser({ email: input.email })
      if (user) {
        logger.logWarn(`Double register`, { email: input.email })
        return result.fail({ doubleRegister: input.email })
      } else {
        logger.logInfo(`Registered: ${input.email}`)
        return result.ok(db.updateUser(input))
      }
    },
    middlewares: [
      {
        name: 'Avoid weak passwords',
        apply: async (args, next) =>
          args.input.password === '123' ? result.fail({ weakPassword: args.input.password }) : next(args),
      },
    ],
    options: { namespace: 'authentication' },
  })

  const completeProfile = functions.withContext<SharedContext & { authenticatedUser?: { email: string } }>().build({
    input: types.object({ firstname: types.string(), lastname: types.string() }),
    output: User,
    error: types.union({ unauthorized: types.string() }),
    body: async ({ input, context: { db, authenticatedUser } }) => {
      if (!authenticatedUser) {
        return result.fail({ unauthorized: 'unauthorized' })
      }
      const user = db.findUser({ email: authenticatedUser.email })
      if (!user) {
        throw new Error('Unrechable')
      }
      return result.ok(db.updateUser({ ...user, ...input }))
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

  const res = await client.functions.register({ email: 'admin@domain.com', password: '123' })
  expect(res.isOk).toBe(false)

  await client.functions.register({ email: 'admin@domain.com', password: '1234' })
  const failedRegisterResult = await client.functions.register({ email: 'admin@domain.com', password: '1234' })
  expect(failedRegisterResult.isOk).toBe(false)
  expect(!failedRegisterResult.isOk && failedRegisterResult.error).toEqual({ doubleRegister: 'admin@domain.com' })

  const failedLoginResult = await client.functions.login({ email: 'admin@domain.com', password: '4321' })
  expect(failedLoginResult.isOk).toBe(false)
  expect(!failedLoginResult.isOk && failedLoginResult.error).toEqual({ invalidUsernameOrPassword: 'admin@domain.com' })

  const loginResult = await client.functions.login({ email: 'admin@domain.com', password: '1234' })
  expect(loginResult.isOk).toEqual(true)
  expect(loginResult.isOk && loginResult.value).toEqual({
    user: { email: 'admin@domain.com', password: '****' },
    jwt: 'admin@domain.com',
  })

  const completeProfileResult = await client.functions.completeProfile({ firstname: 'Pieter', lastname: 'Mondriaan' })
  expect(!completeProfileResult.isOk && completeProfileResult.error).toEqual({ unauthorized: 'unauthorized' })
  expect(
    async () =>
      await client.functions.completeProfile(
        { firstname: 'Pieter', lastname: 'Mondriaan' },
        { metadata: { authorization: 'wrong' } },
      ),
  ).rejects.toThrow()
  if (loginResult.isOk && loginResult.value) {
    const authClient = client.withMetadata({ authorization: loginResult.value.jwt })
    const myUser = await authClient.functions.completeProfile(
      { firstname: 'Pieter', lastname: 'Mondriaan' },
      { operationId: '123' },
    )
    expect(myUser.isOk && myUser.value).toEqual({
      email: 'admin@domain.com',
      password: '1234',
      firstname: 'Pieter',
      lastname: 'Mondriaan',
    })
  }
})

describe('Unique type name', () => {
  test('Two different type cannot have the same name', () => {
    const n = types.number().setName('Input')
    const input = types.number().setName('Input')
    const output = types.union({ n, v: input.setName('V') })
    const error = types.never()
    const f = functions.build({
      input,
      output,
      error,
      body: () => {
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
    const type = () => types.object({ type: types.optional(type), value: types.string() })
    const dummy = functions.build({
      input: type,
      output: type,
      error: types.never(),
      body: async ({ input }) => {
        if (input?.value === 'wrong') {
          return result.ok({}) //projection not respected sometimes!
        }
        return result.ok(input)
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
    expect(result1.isOk && result1.value).toEqual({ value: '123' })
    const result2 = await client.functions.dummy({ value: '123' }, { projection: { type: { type: true } } })
    expect(result2.isOk && result2.value).toEqual({})
    expect(
      async () => await client.functions.dummy({ value: '123' }, { projection: { type: { type: { type: true } } } }),
    ).rejects.toThrowError('Max projection depth reached: requested projection have a depth of 3. The maximum is 2.')
    expect(async () => await client.functions.dummy({ value: 'wrong' })).rejects.toThrowError(
      '[{"missingField":"value","path":{"fragments":[]}}]',
    )
  })
})

test('Module interface definition', () => {
  const id = types.string({ name: 'ID' })
  const input = () =>
    types.object({
      id,
      other,
    }).setName('Input')
  const other = () =>
    types.object({
      input: types.optional(input),
    }).setName('Other')
  const stringToNumberI = functions.define({
    input,
    output: types.number(),
    error: types.never(),
  })
  const myModuleI = module.define({
    name: 'test',
    version: '0.0.0',
    functions: { stringToNumber: stringToNumberI },
  })

  const serialization = JSON.parse(JSON.stringify(module.serialize(myModuleI)))
  expect(serialization).toBe({})

  const stringToNumber = functions.build({
    ...myModuleI.functions.stringToNumber,
    async body({ input }) {
      throw new Error('Not implemented')
    },
  }) satisfies typeof stringToNumberI

  const myModule = module.build({
    ...myModuleI,
    functions: { stringToNumber },
    async context(input, args) {
      return {}
    },
  }) satisfies typeof myModuleI

  expect(myModuleI.functions.stringToNumber.input.kind).toBe(types.Kind.String)
  expect(myModule.functions.stringToNumber.body).toBeTruthy()
})
