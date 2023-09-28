export type Unit = 'seconds' | 'minutes' | 'hours'

/**
 * {@link Rate} expressed by a string
 */
export type RateLiteral = `${number} requests in ${number} ${Unit}`

/**
 * Rate description.
 */
export type Rate = {
  /**
   * Maximum requests in the given period
   */
  requests: number
  /**
   * Period size
   */
  period: number
  /**
   * Period unit.
   */
  unit: Unit
}

export function parseRate(rate: RateLiteral): Rate {
  const [requestString, other] = rate.split(' requests in ')
  const [periodString, unitString] = other.split(' ')
  const requests = Number(requestString)
  const period = Number(periodString)
  const unit = unitString as Unit
  return { requests, period, unit }
}
