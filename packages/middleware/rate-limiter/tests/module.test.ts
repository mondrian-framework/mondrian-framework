import { rateLimiter } from '../src'
import { Rate } from '../src/rate'
import { result, model } from '@mondrian-framework/model'
import { module, functions, sdk } from '@mondrian-framework/module'
import { expect, test } from 'vitest'

test('Rate limiter middleware', async () => {
  const LoginInput = model
    .object({
      email: model.string(),
      password: model.string(),
    })
    .setName('LoginInput')
  const LoginOutput = model.object({ jwt: model.string() }).nullable().setName('LoginOuput')
  type SharedContext = { ip: string }
  const LoginError = { invalidUsernameOrPassword: model.string(), tooManyRequests: model.string() }
  const rateLimitByIpEmail = rateLimiter.build<
    typeof LoginInput,
    typeof LoginOutput,
    typeof LoginError,
    undefined,
    SharedContext
  >({
    key: ({ context, input }) => (input.email === 'admin@domain.com' ? null : `${context.ip}-${input.email}`),
    rate: '1 requests in 1 minutes',
    onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })),
  })

  const rateLimitByEmail = rateLimiter.build<
    typeof LoginInput,
    typeof LoginOutput,
    typeof LoginError,
    undefined,
    SharedContext
  >({
    key: ({ input }) => input.email,
    rate: new Rate({ requests: 1, period: 1, scale: 'hour' }),
  })

  const login = functions.withContext<SharedContext & { from?: string }>().build({
    input: LoginInput,
    output: LoginOutput,
    errors: LoginError,
    retrieve: undefined,
    body: async ({ input }) => {
      if (input.email === 'test@domain.com' && input.password === '1234') {
        return result.ok({ jwt: '...' })
      }
      return result.fail({ invalidUsernameOrPassword: '' })
    },
    middlewares: [rateLimitByIpEmail, rateLimitByEmail],
  })

  const m = module.build({
    name: 'test',
    version: '1.0.0',
    functions: { login },
    context: async ({ ip }: { ip: string }) => {
      return { ip }
    },
  })

  const client = sdk.withMetadata<{ ip?: string }>().build({
    module: m,
    context: async ({ metadata }) => {
      return { ip: metadata?.ip ?? 'local' }
    },
  })

  const failedLoginResult = await client.functions.login({ email: 'test@domain.com', password: '4321' })
  expect(failedLoginResult.isOk).toBe(false)
  expect(!failedLoginResult.isOk && failedLoginResult.error).toEqual({ invalidUsernameOrPassword: '' })

  const failedLoginResult2 = await client.functions.login({ email: 'test@domain.com', password: '1234' })
  expect(failedLoginResult2.isOk).toBe(false)
  expect(!failedLoginResult2.isOk && failedLoginResult2.error).toEqual({
    tooManyRequests: 'Too many requests. Retry in few minutes.',
  })

  const failedLoginResult3 = await client.functions.login({ email: 'admin@domain.com', password: '4321' })
  expect(failedLoginResult3.isOk).toBe(false)
  expect(!failedLoginResult3.isOk && failedLoginResult3.error).toEqual({ invalidUsernameOrPassword: '' })

  expect(async () => await client.functions.login({ email: 'admin@domain.com', password: '4321' })).rejects.toThrow(
    'Too many requests',
  )
})
