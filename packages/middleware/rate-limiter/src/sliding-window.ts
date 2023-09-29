import { Rate } from './rate'
import { Slot } from './slot'
import { SlotProvider } from './slot-provider'

/**
 * This class keeps count of a series of requests and determines whether the current rate exceeds the defined one.
 * It works by maintaining the request count in two temporal {@link Slot} instances: the old one and the current one.
 * All {@link Slot}s have the same temporal length of "samplingPeriodSeconds". All new requests that go
 * through will be counted in the current {@link Slot}. When we check if a request can go through
 * or not, we count all the requests registered in the current {@link Slot} and a fraction in the old {@link Slot}
 * based on how much they overlap (in time). If the request count surpasses the rate limit, the request cannot go through.
 * The current {@link Slot} will eventually become the old slot. In this case, a new current {@link Slot} will be created.
 */
export class SlidingWindow {
  private readonly samplingPeriodSeconds: number
  private readonly rateLimit: number
  private readonly slots: Map<number, Slot> //slot starting time -> slot
  private readonly slotProvider: SlotProvider
  private readonly key: string
  private rateLimitedUntilSeconds: number | null

  constructor({ rate, slotProvider, key }: { rate: Rate; slotProvider: SlotProvider; key: string }) {
    if (rate.periodInSeconds < 1) {
      throw new Error('Sampling period must be at least 1 second')
    }
    if (rate.requests < 0) {
      throw new Error('Rate limit must be a positive duration')
    }
    this.rateLimitedUntilSeconds = null
    this.samplingPeriodSeconds = rate.periodInSeconds
    this.rateLimit = rate.requests
    this.slotProvider = slotProvider
    this.key = key
    this.slots = new Map()
  }

  private getOrCreateSlot(slotStartingTimeSeconds: number): Slot {
    const slot = this.slots.get(slotStartingTimeSeconds)
    if (slot) {
      return slot
    } else {
      const newSlot = this.slotProvider.create({
        startingTimeSeconds: slotStartingTimeSeconds,
        durationSeconds: this.samplingPeriodSeconds,
        key: this.key,
      })
      this.slots.set(slotStartingTimeSeconds, newSlot)
      return newSlot
    }
  }

  private getSlots(nowSeconds: number): [Slot, Slot] {
    //the time is divided in block of sampling period size
    //the actual slot starting time is the starting time of the slot we are inside (in time)
    //|----1----|----2----|----3----|.....
    //          ^        ^
    //         here     now
    const actualSlotStartingTimeSecond = nowSeconds - (nowSeconds % this.samplingPeriodSeconds)
    //the old slot starting time is just the actual slot starting time minus the sampling period
    const oldSlotStartingTimeSecond = actualSlotStartingTimeSecond - this.samplingPeriodSeconds
    const actualSlot = this.getOrCreateSlot(actualSlotStartingTimeSecond)
    const oldSlot = this.getOrCreateSlot(oldSlotStartingTimeSecond)
    return [oldSlot, actualSlot]
  }

  /**
   * Checks if it's allowed to make another request based on the specified rate limit and the current request count.
   * If it's allowed, the passing request will be counted; otherwise, the rate-limited request will not be counted.
   * @param now The current time.
   * @return 'allowed' if the request can go through, 'rate-limited' otherwise.
   */
  isRateLimited(now: Date): 'allowed' | 'rate-limited' {
    const nowSeconds = now.getTime() / 1000.0
    //check if we cached the rate-limited-until
    if (this.rateLimitedUntilSeconds !== null && nowSeconds <= this.rateLimitedUntilSeconds) {
      return 'rate-limited'
    }
    this.rateLimitedUntilSeconds = null
    const [oldSlot, currentSlot] = this.getSlots(nowSeconds)
    //free memory after getting the old slot and current slot
    this.removeExpiredSlots()
    const oldValue = oldSlot.value()
    const currentValue = currentSlot.value()
    /**
     * In order to compute the actual requests, we need to sum the current requests to the old requests multiplied
     * by the percentage of the overlapping time with the old slot.
     *
     * N = now
     * P = this.samplingPeriodSeconds
     * S = currentSlot.startingTimeSeconds
     * O = oldValue
     * C = currentValue
     * X = requests = C + O * ((P - (N - S)) / P)
     */
    const requests =
      currentValue +
      (oldValue * (this.samplingPeriodSeconds - (nowSeconds - currentSlot.startingTimeSeconds))) /
        this.samplingPeriodSeconds
    if (requests < this.rateLimit) {
      //here we are not rate limited yet
      currentSlot.inc()
      return 'allowed'
    } else {
      // We can predict for how much time this sliding window will block new requests.
      // This is useful to make it more efficient when the SlotProvider is not in memory.
      if (oldValue === 0) {
        //if the old slot is not used, this is rate limited only by the current slot, so we'll block new requests until a new slot appears
        this.rateLimitedUntilSeconds = currentSlot.startingTimeSeconds + this.samplingPeriodSeconds
      } else {
        //otherwise, we need to take into account how much we should wait in order reduce the impact of the old slot
        //this is the equation:
        /**
         * N = now
         * P = this.samplingPeriodSeconds
         * S = currentSlot.startingTimeSeconds
         * O = oldValue
         * C = currentValue
         * L = this.rateLimit
         * X = requests = C + O * ((P - (N - S)) / P)
         *
         * We need to find the nearest N that satisfies X < L
         *
         * 1) requests < this.rateLimit
         * 2) X < L
         * 3) C + (O * (P - N + S)) / P < L
         * 4) N > P + S - ((L - C) * P) / O   <--- that's the formula
         */
        this.rateLimitedUntilSeconds =
          this.samplingPeriodSeconds +
          currentSlot.startingTimeSeconds -
          ((this.rateLimit - currentValue) * this.samplingPeriodSeconds) / oldValue
      }

      return 'rate-limited'
    }
  }

  /**
   * Removes all old slots to free memory, keeping only the current slot and the previous slot (last two slots).
   */
  private removeExpiredSlots() {
    if (this.slots.size > 2) {
      const slots = [...this.slots.values()].sort(
        (slot1, slot2) => slot2.startingTimeSeconds - slot1.startingTimeSeconds,
      )
      for (let i = 2; i < slots.length; i++) {
        this.slots.delete(slots[i].startingTimeSeconds)
      }
    }
  }
}
