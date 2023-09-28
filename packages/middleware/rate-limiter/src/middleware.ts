import { InMemorySlotProvider } from './implementation/in-memory'
import { Rate, RateLiteral } from './rate'
import { SlidingWindowProvider } from './sliding-window'
import { SlotProvider } from './slot'
import { types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

/**
 * Limits a function execution with the given rate limit.
 * You can group different calls toghether by using the key function. If the key function returns `null` not rate limit is applied.
 * Example:
 * ```typescript
 * const rateLimitByIpEmail = rateLimitMiddleware<
 *   typeof LoginInput,
 *   typeof LoginOutput,
 *   typeof LoginError,
 *   SharedContext
 * >({
 *   key: ({ context, input }) => (input.email === 'admin@domain.com' ? null : `${context.ip}-${input.email}`),
 *   options: { rate: '10 requests in 5 minutes' },
 *   onLimit: () => Promise.resolve(result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })),
 * })
 * ```
 */
export function rateLimitMiddleware<
  const I extends types.Type,
  const O extends types.Type,
  const E extends functions.ErrorType,
  const Context extends Record<string, unknown>,
>({
  key,
  options,
  onLimit,
}: {
  key: (args: functions.FunctionArguments<I, O, Context>) => string | null
  options: {
    rate: Rate | RateLiteral
    slotProvider?: SlotProvider
  }
  onLimit?: (args: functions.FunctionArguments<I, O, Context>) => functions.FunctionResult<O, E>
}): functions.Middleware<I, O, E, Context> {
  const provider = new SlidingWindowProvider({
    rate: options.rate,
    slotProvider: options.slotProvider ?? new InMemorySlotProvider(),
  })
  return {
    name: 'Rate limiter',
    apply(args, next) {
      const k = key(args)
      if (k === null) {
        return next(args)
      }
      const window = provider.get({ key: k })
      const res = window.inc()
      if (res === 'allowed') {
        return next(args)
      }
      if (onLimit) {
        return onLimit(args)
      }
      throw new Error(`Too many requests`)
    },
  }
}
