import { RedisSlotProvider, SlotProvider } from '@mondrian-framework/rate-limiter'
import { createClient } from '@redis/client'

const redisClient = process.env.REDIS_URL ? createClient() : undefined
redisClient?.on('error', (err) => console.log('Redis Client Error', err))
redisClient?.connect()
export const slotProvider: SlotProvider | undefined = redisClient && new RedisSlotProvider(redisClient) 
