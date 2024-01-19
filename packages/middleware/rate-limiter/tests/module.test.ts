import { rateLimiter } from '../src'
import { Rate } from '../src/rate'
import { result, model } from '@mondrian-framework/model'
import { module, functions, sdk, provider } from '@mondrian-framework/module'
import { expect, test } from 'vitest'

test('Rate limiter middleware', async () => {
  const LoginInput = model
    .object({
      email: model.string(),
      password: model.string(),
    })
    .setName('LoginInput')
  const LoginOutput = model.object({ jwt: model.string() }).nullable().setName('LoginOuput')
  const locationProvider = provider.build({
    apply: async ({ ip }: { ip: string }) => {
      return result.ok({ ip })
    },
  })
  const LoginError = { invalidUsernameOrPassword: model.string(), tooManyRequests: model.string() }
  const rateLimitByIpEmail = rateLimiter.build<
    typeof LoginInput,
    typeof LoginOutput,
    typeof LoginError,
    undefined,
    { location: typeof locationProvider }
  >({
    key: ({ location: { ip }, input }) => (input.email === 'admin@domain.com' ? null : `${ip}-${input.email}`),
    rate: '1 requests in 1 minutes',
    onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })),
  })

  const rateLimitByEmail = rateLimiter.build<
    typeof LoginInput,
    typeof LoginOutput,
    typeof LoginError,
    undefined,
    { location: typeof locationProvider }
  >({
    key: ({ input }) => input.email,
    rate: new Rate({ requests: 1, period: 1, scale: 'hour' }),
  })

  const login = functions
    .define({
      input: LoginInput,
      output: LoginOutput,
      errors: LoginError,
      retrieve: undefined,
    })
    .withProviders({ location: locationProvider })
    .implement({
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
    functions: { login },
  })

  const client = sdk.withMetadata<{ ip?: string }>().build({
    module: m,
    context: async ({ metadata }) => {
      return { ip: metadata?.ip ?? 'local' }
    },
  })

  const failedLoginResult = await client.functions.login({ email: 'test@domain.com', password: '4321' })
  expect(failedLoginResult.isOk).toBe(false)
  expect(failedLoginResult.isFailure && failedLoginResult.error).toEqual({ invalidUsernameOrPassword: '' })

  const failedLoginResult2 = await client.functions.login({ email: 'test@domain.com', password: '1234' })
  expect(failedLoginResult2.isOk).toBe(false)
  expect(failedLoginResult2.isFailure && failedLoginResult2.error).toEqual({
    tooManyRequests: 'Too many requests. Retry in few minutes.',
  })

  const failedLoginResult3 = await client.functions.login({ email: 'admin@domain.com', password: '4321' })
  expect(failedLoginResult3.isOk).toBe(false)
  expect(failedLoginResult3.isFailure && failedLoginResult3.error).toEqual({ invalidUsernameOrPassword: '' })

  await expect(
    async () => await client.functions.login({ email: 'admin@domain.com', password: '4321' }),
  ).rejects.toThrow('Too many requests')
})
