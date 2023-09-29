import { Slot } from '../slot'
import { SlotProvider } from '../slot-provider'

/**
 * Dummy slot implementation. Used for testing purpose.
 */
class InMemorySlot implements Slot {
  readonly startingTimeSeconds: number
  private counter: number

  constructor(startingTimeSeconds: number) {
    this.counter = 0
    this.startingTimeSeconds = startingTimeSeconds
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
 * Dummy slot provider implementation. Used for testing purpose.
 * Do not use this in production.
 */
export class InMemorySlotProvider implements SlotProvider {
  create({ startingTimeSeconds }: { startingTimeSeconds: number }): Slot {
    return new InMemorySlot(startingTimeSeconds)
  }
}
