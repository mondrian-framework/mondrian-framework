import { Slot } from '../slot'
import { SlotProvider } from '../slot-provider'
import { RedisClientType } from '@redis/client'

/**
 * Slot implementation using redis as shared storage.
 */
class RedisSlot implements Slot {
  readonly startingTimeSeconds: number
  readonly durationSeconds: number
  readonly key: string
  readonly client: RedisClientType
  private counter: number

  constructor({
    startingTimeSeconds,
    durationSeconds,
    key,
    client,
  }: {
    startingTimeSeconds: number
    durationSeconds: number
    key: string
    client: RedisClientType
  }) {
    this.counter = 0
    this.startingTimeSeconds = startingTimeSeconds
    this.durationSeconds = durationSeconds
    this.key = key
    this.client = client

    // Read the initial value asynchronously.
    // No need to await this operation because we don't want to slow down the system just to ensure
    // we rate limit all the requests that should be rate limited. 1 or 2 requests that go through
    // when they should be rate limited is not a significant concern!
    this.client
      .get(this.key)
      .catch(() => console.error('REDIS: Failed to get', this.key))
      .then((value) => {
        if (value != null) {
          const v = Number(value)
          if (!Number.isNaN(v)) {
            this.counter = v
          }
        }
      })
  }

  inc(): void {
    if (this.counter >= Number.MAX_SAFE_INTEGER) {
      return
    }
    // This is not awaited as well, following the same logic as the initial read.
    this.client
      .incr(this.key)
      .catch(() => console.error('REDIS: Failed to incr', this.key))
      .then((value) => {
        if (value == null) {
          return
        }
        // set the expiration time only one time
        if (this.counter === 0) {
          //set the expiration time of this value when this slot will be 3 slot older (* 3)
          const expirationDate = new Date((this.startingTimeSeconds + this.durationSeconds * 3) * 1000)
          this.client
            .expireAt(this.key, expirationDate)
            .catch(() => console.error('REDIS: Failed to set expiration', this.key, 'NX'))
            .then(() => {})
        }
        this.counter = value
      })
  }

  value(): number {
    return this.counter
  }
}

/**
 * Redis slot provider. Utilizes a Redis client to offer rate limiting capabilities for any middleware.
 * It is suitable for use when a service needs to scale horizontally since the slot's counters are shared between machines.
 */
export class RedisSlotProvider implements SlotProvider {
  readonly client: RedisClientType<any, any, any>
  readonly keyPrefix: string

  constructor(client: RedisClientType<any, any, any>, keyPrefix: string = 'mondrian-rate-limiter') {
    this.client = client
    this.keyPrefix = keyPrefix
  }

  create(args: { startingTimeSeconds: number; durationSeconds: number; key: string }): Slot {
    // The key of this slot is the concatenation of the prefix, the key given by the user, and the starting time of the slot.
    // Suppose we have a rate limiter middleware with 1 minute period and the key is the user IP.
    // We'll have the slot with this key:
    // "prefix:192.168.0.1:6000060"
    // The next slot for the same user key will be:
    // "prefix:192.168.0.1:6000120"
    // And so on...
    return new RedisSlot({
      ...args,
      key: `${this.keyPrefix}:${args.key}:${args.startingTimeSeconds}`,
      client: this.client,
    })
  }
}
