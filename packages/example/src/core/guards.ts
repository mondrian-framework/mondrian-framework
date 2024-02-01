import { tooManyRequests } from '../interface/common/model'
import { store } from '../rate-limiter'
import { rateLimiter } from '@mondrian-framework/rate-limiter'

export const rateLimitByIpGuard = rateLimiter.buildGuard({
  errors: { tooManyRequests },
  key: ({ ip }: { ip: string }) => ip,
  onLimit: () => ({ tooManyRequests: { limitedBy: 'ip' as const } }),
  rate: '100 requests in 1 hours',
  store,
})
