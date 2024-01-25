import { RedisStore, Store } from '@mondrian-framework/rate-limiter'
import { createClient } from '@redis/client'

const redisClient = process.env.REDIS_URL ? createClient() : undefined
redisClient?.on('error', (err) => console.log('Redis Client Error', err))
redisClient?.connect()
export const store: Store | undefined = redisClient && new RedisStore(redisClient)
