import { Slot, SlotProvider } from '../slot'
import { RedisClientType } from '@redis/client'

class RedisSlot implements Slot {
  readonly fromSecond: number
  readonly durationSecond: number
  readonly key: string
  readonly client: RedisClientType
  private counter: number

  constructor({
    fromSecond,
    durationSecond,
    key,
    client,
  }: {
    fromSecond: number
    durationSecond: number
    key: string
    client: RedisClientType
  }) {
    this.counter = 0
    this.fromSecond = fromSecond
    this.durationSecond = durationSecond
    this.key = `${key}:${fromSecond}`
    this.client = client
  }

  inc(): void {
    this.client
      .incr(this.key)
      .catch(() => console.error('REDIS: Failed to incr', this.key))
      .then((value) => {
        if (this.counter === 0) {
          this.client
            .expireAt(this.key, new Date((this.fromSecond + this.durationSecond + 60) * 1000), 'NX')
            .catch(() => console.error('REDIS: Failed to set expiration', this.key))
            .then(() => {})
        }
        if (value != null) {
          this.counter = value
        }
      })
  }

  value(): number {
    this.client
      .get(this.key)
      .catch(() => console.error('REDIS: Failed to get', this.key))
      .then((value) => {
        if (value != null) {
          const v = Number(value)
          if (!Number.isNaN) {
            this.counter = v
          }
        }
      })
    return this.counter
  }
}

/**
 * Redis slot provider. Uses a redis client to provide rate limiting capabilities for any middleware.
 * It can be used when a service needs to scale horizontally.
 */
export class RedisSlotProvider implements SlotProvider {
  readonly client: RedisClientType<any, any, any>
  readonly keyPrefix: string

  constructor(client: RedisClientType<any, any, any>, keyPrefix: string = 'mondrian-rate-limiter:') {
    this.client = client
    this.keyPrefix = keyPrefix
  }

  create(args: { fromSecond: number; durationSecond: number; key: string }): Slot {
    return new RedisSlot({ ...args, key: `${this.keyPrefix}${args.key}`, client: this.client })
  }
}
