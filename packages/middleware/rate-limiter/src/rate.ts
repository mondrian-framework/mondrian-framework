export type Unit = 'seconds' | 'minutes' | 'hours'

/**
 * {@link Rate} expressed by a string
 */
export type RateLiteral = `${number} requests in ${number} ${Unit}`

/**
 * Rate description.
 */
export class Rate {
  /**
   * Maximum requests in the given period
   */
  readonly requests: number
  /**
   * Period size
   */
  readonly period: number
  /**
   * Period unit.
   */
  readonly unit: Unit

  constructor({ requests, period, unit }: { requests: number; period: number; unit: Unit }) {
    this.requests = requests
    this.period = period
    this.unit = unit
  }

  get periodInSeconds(): number {
    return this.period * (this.unit === 'hours' ? 3600 : this.unit === 'minutes' ? 60 : 1)
  }
}

export function parseRate(rate: RateLiteral): Rate {
  const [requestString, other] = rate.split(' requests in ')
  const [periodString, unitString] = other.split(' ')
  const requests = Number(requestString)
  const period = Number(periodString)
  const unit = unitString as Unit
  return new Rate({ requests, period, unit })
}
