import { InMemorySlotProvider } from './implementation/in-memory'
import { Rate, RateLiteral, parseRate } from './rate'
import { SlidingWindowProvider } from './sliding-window-provider'
import { SlotProvider } from './slot-provider'
import { types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

/**
 * Input needed to instantiate a rate limiter middleware.
 */
type RateLimitMiddlewareInput<
  I extends types.Type,
  O extends types.Type,
  E extends functions.ErrorType,
  R extends functions.OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> = {
  /**
   * This function determines the "group" the request belongs to, allowing different keys for rate limiting.
   * If null is returned, no rate limiting is applied.
   * For example, the key can be generated from the client's IP, the userId calling the service, or a combination of your choice.
   * @param args The function arguments.
   * @returns The key of the group or null.
   */
  key: (args: functions.FunctionArguments<I, O, R, Context>) => string | null

  /**
   * The rate limit to apply to requests passing through this middleware.
   */
  rate: Rate | RateLiteral

  /**
   * This function determines what to do in case of rate-limited requests. You can either return a default value or an error.
   * If this is not implemented, a generic error will be thrown.
   * @param args The function arguments.
   * @returns A function result instance.
   */
  onLimit?: (args: functions.FunctionArguments<I, O, R, Context>) => functions.FunctionResult<O, E>

  /**
   * The actual implementation of the rate-limiter storage. If undefined is passed, then an {@link InMemorySlotProvider} is used.
   * With {@link InMemorySlotProvider}, the counters are kept in memory only in this process.
   *
   * If the service scales across multiple machines, a {@link RedisSlotProvider} should be used to share the {@link Slot}'s counters.
   */
  slotProvider?: SlotProvider
}

/**
 * Limits a function execution with the given rate limit.
 * You can group different calls together by using the key function. If the key function returns `null`, no rate limiting is applied.
 * NB: Use a {@link RedisSlotProvider} or equivalent in production if you have multiple machines serving the same services.
 * The recommendation is not to use the {@link InMemorySlotProvider} in production. If you do not specify a slotProvider, an {@link InMemorySlotProvider} will be used.
 *
 * Example:
 * ```typescript
 * import { rateLimitMiddleware } from '@mondrian-framework/rate-limiter'
 * import { RedisSlotProvider, SlotProvider } from '@mondrian-framework/rate-limiter'
 * import { createClient } from '@redis/client'
 *
 * //Slot provider initialization
 * const redisClient = process.env.REDIS_URL ? createClient() : undefined
 * redisClient?.on('error', (err) => console.log('Redis Client Error', err))
 * redisClient?.connect()
 * export const slotProvider: SlotProvider | undefined = redisClient && new RedisSlotProvider(redisClient)
 *
 * const rateLimitByIpEmail = rateLimitMiddleware<
 *   typeof LoginInput,
 *   typeof LoginOutput,
 *   typeof LoginError,
 *   SharedContext
 * >({
 *   key: ({ context, input }) => (input.email === 'admin@domain.com' ? null : `${context.ip}-${input.email}`),
 *   rate: '10 requests in 5 minutes',
 *   onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in a few minutes.' })),
 * })
 * ```
 */
export function build<
  const I extends types.Type,
  const O extends types.Type,
  const E extends functions.ErrorType,
  const R extends functions.OutputRetrieveCapabilities,
  const Context extends Record<string, unknown>,
>({
  key,
  rate,
  slotProvider,
  onLimit,
}: RateLimitMiddlewareInput<I, O, E, R, Context>): functions.Middleware<I, O, E, R, Context> {
  const provider = new SlidingWindowProvider({
    rate: typeof rate === 'string' ? parseRate(rate) : rate,
    slotProvider: slotProvider ?? new InMemorySlotProvider(),
  })
  return {
    name: 'Rate limiter',
    apply(args, next) {
      const now = new Date()
      const k = key(args)
      if (k === null) {
        return next(args)
      }
      const window = provider.getOrCreateSlidingWindow(k)
      const res = window.isRateLimited(now)
      if (res === 'allowed') {
        return next(args)
      } else if (onLimit) {
        return onLimit(args)
      } else {
        throw new Error(`Too many requests`)
      }
    },
  }
}
