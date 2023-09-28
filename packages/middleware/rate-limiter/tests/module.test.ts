import { rateLimitMiddleware } from '../src/middleware'
import { result, types } from '@mondrian-framework/model'
import { module, functions, sdk } from '@mondrian-framework/module'
import { expect, test } from 'vitest'
import { Rate } from '../src/rate'

test('Rate limiter middleware', async () => {
  const LoginInput = types
    .object({
      email: types.string(),
      password: types.string(),
    })
    .setName('LoginInput')
  const LoginOutput = types.object({ jwt: types.string() }).nullable().setName('LoginOuput')
  type SharedContext = { ip: string }
  const LoginError = types.union({ invalidUsernameOrPassword: types.string(), tooManyRequests: types.string() })
  const rateLimitByIpEmail = rateLimitMiddleware<
    typeof LoginInput,
    typeof LoginOutput,
    typeof LoginError,
    SharedContext
  >({
    key: ({ context, input }) => (input.email === 'admin@domain.com' ? null : `${context.ip}-${input.email}`),
    options: { rate: '1 requests in 1 minutes' },
    onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })),
  })

  const rateLimitByEmail = rateLimitMiddleware<typeof LoginInput, typeof LoginOutput, typeof LoginError, SharedContext>(
    {
      key: ({ input }) => input.email,
      options: { rate: new Rate({ requests: 1, period: 1, unit: 'hours' }) },
    },
  )

  const login = functions.withContext<SharedContext & { from?: string }>().build({
    input: LoginInput,
    output: LoginOutput,
    error: LoginError,
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
    options: { checks: { maxProjectionDepth: 2 } },
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
