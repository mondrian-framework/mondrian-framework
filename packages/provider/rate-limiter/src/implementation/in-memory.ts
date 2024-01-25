import { Slot } from '../slot'
import { Store } from '../store'

/**
 * This slot implementation uses a single counter.
 * The counter is not shared between processes and should not be used in production.
 */
class InMemorySlot implements Slot {
  readonly startingTimeSeconds: number
  readonly durationSeconds: number
  readonly key: string
  private counter: number

  constructor({
    startingTimeSeconds,
    durationSeconds,
    key,
  }: {
    startingTimeSeconds: number
    durationSeconds: number
    key: string
  }) {
    this.counter = 0
    this.startingTimeSeconds = startingTimeSeconds
    this.durationSeconds = durationSeconds
    this.key = key
  }

  inc(): void {
    if (this.counter === Number.MAX_SAFE_INTEGER) {
      return
    } else {
      this.counter++
    }
  }

  value(): number {
    return this.counter
  }
}

/**
 * This class provides only {@link InMemorySlot} slots.
 * It should not be used in production.
 */
export class InMemoryStore extends Store {
  protected createSlot(args: { startingTimeSeconds: number; durationSeconds: number; key: string }): Slot {
    return new InMemorySlot(args)
  }
}
