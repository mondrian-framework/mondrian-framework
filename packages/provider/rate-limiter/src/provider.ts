import { InMemoryStore } from './implementation/in-memory'
import { Rate, RateLiteral, parseRate } from './rate'
import { SlidingWindowProvider } from './sliding-window-provider'
import { Store } from './store'
import { model, result } from '@mondrian-framework/model'
import { functions, guard, provider } from '@mondrian-framework/module'

/**
 * Input needed to instantiate a rate limiter provider.
 */
type RateLimitProviderInput = {
  /**
   * The rate limit to apply to requests passing through this middleware.
   */
  rate: Rate | RateLiteral
  /**
   * The actual implementation of the rate-limiter storage. If undefined is passed, then an {@link InMemoryStore} is used.
   * With {@link InMemoryStore}, the counters are kept in memory only in this process.
   *
   * If the service scales across multiple machines, a {@link RedisStore} should be used to share the {@link Slot}'s counters.
   */
  store?: Store
}

/**
 * Input needed to instantiate a rate limiter guard.
 */
type RateLimitGuardInput<
  ContextInput extends Record<string, unknown>,
  Es extends model.Types,
> = RateLimitProviderInput & {
  /**
   * The errors that can be returned by the onLimit function.
   */
  errors: Es

  /**
   * This function determines the "group" the request belongs to, allowing different keys for rate limiting.
   * If null is returned, no rate limiting is applied.
   * For example, the key can be generated from the client's IP, the userId calling the service, or a combination of your choice.
   * @param args The function arguments.
   * @returns The key of the group or null.
   */
  key: (input: ContextInput) => string | null

  /**
   * This function determines what to do in case of rate-limited requests. You can either return a default value or an error.
   * If this is not implemented, a generic error will be thrown.
   * @param args The function arguments.
   * @returns A function result instance.
   */
  onLimit: (input: ContextInput) => functions.InferErrorType<Es>
}

/**
 * Builds a guard that limits a function execution with the given logic.
 * You can group different calls together by using the key function. If the key function returns `null`, no rate limiting is applied.
 * NB: Use a {@link RedisStore} or equivalent in production if you have multiple machines serving the same services.
 * The recommendation is not to use the {@link InMemoryStore} in production. If you do not specify a store, an {@link InMemoryStore} will be used.
 *
 * Example:
 * ```typescript
 * import { rateLimiter, RedisStore, Store } from '@mondrian-framework/rate-limiter'
 * import { createClient } from '@redis/client'
 *
 * //Slot provider initialization
 * const redisClient = process.env.REDIS_URL ? createClient() : undefined
 * redisClient?.on('error', (err) => console.log('Redis Client Error', err))
 * redisClient?.connect()
 * export const store: Store | undefined = redisClient && new RedisStore(redisClient)
 *
 * const rateLimitByIpEmailGuard = rateLimiter.buildGuard({
 *   errors: { tooManyRequests: model.string() },
 *   key: ({ ip }: { ip: string }) => ip,
 *   rate: '10 requests in 5 minutes',
 *   onLimit: () => ({ tooManyRequests: 'Too many requests. Retry in a few minutes.' }),
 *   store,
 * })
 * ```
 */
export function buildGuard<const ContextInput extends Record<string, unknown>, const Es extends model.Types>({
  errors,
  key,
  rate,
  onLimit,
  store,
}: RateLimitGuardInput<ContextInput, Es>): provider.ContextProvider<ContextInput, undefined, Es> {
  const windowProvider = new SlidingWindowProvider({
    rate: typeof rate === 'string' ? parseRate(rate) : rate,
    store: store ?? new InMemoryStore(),
  })
  return guard.build<ContextInput, Es>({
    errors,
    body(input: ContextInput) {
      const now = new Date()
      const k = key(input)
      if (k === null) {
        return Promise.resolve()
      }
      const window = windowProvider.getOrCreateSlidingWindow(k)
      const res = window.isRateLimited(now)
      if (res === 'allowed') {
        return Promise.resolve()
      } else {
        return Promise.resolve(result.fail(onLimit(input))) as any
      }
    },
  })
}

/**
 * The provided resource returned by the rate limited provider
 */
type RateLimiter = {
  /**
   * Checks and increment if the given group (described by the key) is rate limited.
   * @param key determines the "group" the request belongs to, allowing different keys for rate limiting
   * @returns if the group is rate limited or not
   */
  apply: (key: string) => 'allowed' | 'rate-limited'
  /**
   * Checks wthout counts if the given group (described by the key) is rate limited.
   * @param key determines the "group" the request belongs to, allowing different keys for rate limiting
   * @returns if the group is rate limited or not
   */
  check: (key: string) => 'allowed' | 'rate-limited'
}

/**
 * Builds a provider guard that provides a rate limiter.
 * NB: Use a {@link RedisStore} or equivalent in production if you have multiple machines serving the same services.
 * The recommendation is not to use the {@link InMemoryStore} in production. If you do not specify a store, an {@link InMemoryStore} will be used.
 *
 * Example:
 * ```typescript
 * const rateLimitByEmailProvider = rateLimiter.buildProvider({
 *   rate: '10 requests in 1 minute',
 *   store,
 * })
 *
 * const login = functions.define({
 *   input: model.object({
 *     email: model.email(),
 *     password: model.string ()
 *   }),
 *   errors: {
 *     tooManyRequests: model.string()
 *   }
 * }).use({
 *   rateLimiter: rateLimitByEmailProvider
 * }).implement({
 *   async body({ input, rateLimiter }) {
 *   if (rateLimiter.apply(input.email) === 'rate-limited') {
 *     return result.fail({ tooManyRequests: "Too many requests" })
 *   }
 *   //...
 * })
 * ```
 */
export function buildProvider({
  rate,
  store,
}: RateLimitProviderInput): provider.ContextProvider<{}, RateLimiter, undefined> {
  const windowProvider = new SlidingWindowProvider({
    rate: typeof rate === 'string' ? parseRate(rate) : rate,
    store: store ?? new InMemoryStore(),
  })
  return provider.build<{}, any, undefined>({
    async body(_: {}) {
      const rateLimiter: RateLimiter = {
        apply: (k: string) => {
          const now = new Date()
          const window = windowProvider.getOrCreateSlidingWindow(k)

          const res = window.isRateLimited(now, true)
          return res
        },
        check: (k: string) => {
          const now = new Date()
          const window = windowProvider.getOrCreateSlidingWindow(k)
          const res = window.isRateLimited(now, false)
          return res
        },
      }
      return result.ok(rateLimiter)
    },
  })
}
