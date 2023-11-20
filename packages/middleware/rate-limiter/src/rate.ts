export type TimeScale = 'second' | 'minute' | 'hour'

/**
 * {@link Rate} expressed as a string.
 * Example:
 * ```typescript
 * // Indicates a maximum of 10 requests in a period of 1 minute
 * const rate: RateLiteral = '10 requests in 1 minute'
 *
 * // Indicates a maximum of 1 request in a period of 1.5 seconds
 * const rate: RateLiteral = '1 request in 1.5 seconds'
 * ```
 */
export type RateLiteral = `${number} ${'request' | 'requests'} in ${number} ${TimeScale | `${TimeScale}s`}`

/**
 * A {@link Rate} indicates the maximum number of requests that can be made in a specific period of time.
 * For example:
 * ```typescript
 * // Indicates a maximum of 200 requests in a period of 3 hours
 * const rate: Rate = { requests: 200, period: 3, unit: 'hour' }
 * ```
 * For simplicity, a Rate could be expressed with a literal {@link RateLiteral}.
 */
export class Rate {
  readonly requests: number
  readonly period: number
  readonly scale: TimeScale

  constructor({ requests, period, scale }: { requests: number; period: number; scale: TimeScale }) {
    this.requests = requests
    this.period = period
    this.scale = scale
  }

  /**
   * The period of this rate scaled to 'second' unit.
   */
  get periodInSeconds(): number {
    switch (this.scale) {
      case 'hour':
        return this.period * 3600
      case 'minute':
        return this.period * 60
      case 'second':
        return this.period
    }
  }
}

/**
 * Parses the rate literal into a {@link Rate} object.
 * @param rate The rate literal string.
 * @returns The parsed {@link Rate}.
 */
export function parseRate(rate: RateLiteral): Rate {
  const [requestString, other] = rate.includes('requests') ? rate.split(' requests in ') : rate.split(' request in ')
  const [periodString, scaleString] = other.split(' ')
  const requests = Number(requestString)
  const period = Number(periodString)
  const scale: TimeScale =
    scaleString === 'second' || scaleString === 'seconds'
      ? 'second'
      : scaleString === 'minute' || scaleString === 'minutes'
        ? 'minute'
        : 'hour'
  return new Rate({ requests, period, scale })
}
