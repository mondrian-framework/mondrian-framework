# Rate limiter

Inspired by [Cloudflare](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)

## Install

```
npm install @mondrian-framework/rate-limiter
```

## Usage

```typescript
import { functions } from '@mondrian-framework/module'
import { rateLimitMiddleware } from '@mondrian-framework/rate-limiter'
import { RedisSlotProvider, SlotProvider } from '@mondrian-framework/rate-limiter'
import { createClient } from '@redis/client'

const redisClient = process.env.REDIS_URL ? createClient() : undefined
redisClient?.on('error', (err) => console.log('Redis Client Error', err))
redisClient?.connect()
export const slotProvider: SlotProvider | undefined = redisClient && new RedisSlotProvider(redisClient)

const loginRateLimit = rateLimitMiddleware<typeof loginData, typeof user, typeof loginError, LoginContext>({
  key: ({ input }) => input.email,
  rate: '100 requests in 1 hour',
  onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })),
  slotProvider,
})

export const login = functions
  .define({
    input: loginData,
    output: user,
    error: loginError,
  })
  .implement<LoginContext>({
    body: async ({ input, context }) => {
      // ...
    },
    middlewares: [loginRateLimit],
  })
```
