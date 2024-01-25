# Rate limiter

Inspired by [Cloudflare](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)

## Install

```
npm install @mondrian-framework/rate-limiter
```

## Usage

```typescript
import { functions } from '@mondrian-framework/module'
import { rateLimiter } from '@mondrian-framework/rate-limiter'
import { RedisStore, Store } from '@mondrian-framework/rate-limiter'
import { createClient } from '@redis/client'

const redisClient = process.env.REDIS_URL ? createClient() : undefined
redisClient?.on('error', (err) => console.log('Redis Client Error', err))
redisClient?.connect()
const store: Store | undefined = redisClient && new RedisStore(redisClient)

const rateLimitByIpGuard = rateLimiter.buildGuard({
  errors: { tooManyRequests },
  key: ({ ip }: { ip: string }) => ip,
  onLimit: () => ({ tooManyRequests: { details: { limitedBy: 'ip' as const } } }),
  rate: '100 requests in 1 hours',
  store,
})

const rateLimitByEmailProvider = rateLimiter.buildProvider({
  rate: '10 requests in 1 minute',
  store,
})

//asign provider or guard to functions...
```
