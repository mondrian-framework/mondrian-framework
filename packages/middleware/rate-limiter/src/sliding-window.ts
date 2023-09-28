import { Rate } from './rate'
import { Slot, SlotProvider } from './slot'

/**
 * Rate limit at `rateLimit` in the `samplingPeriod`.
 * Example of maximum 10 request every 2 minutes:
 * ```typescript
 * new SlidingWindow({ rateLimit: 10, samplingPeriod: "2 minutes" })
 * ```
 */
export class SlidingWindowProvider {
  private readonly slidingWindows: Map<string, SlidingWindow> = new Map()
  private readonly rate: Rate
  private readonly slotProvider: SlotProvider

  constructor({ rate, slotProvider }: { rate: Rate; slotProvider: SlotProvider }) {
    this.rate = rate
    this.slotProvider = slotProvider
  }

  get(key: string): SlidingWindow {
    const slidingWindow = this.slidingWindows.get(key)
    if (slidingWindow) {
      return slidingWindow
    } else {
      const newSlidingWindow = new SlidingWindow({ rate: this.rate, slotProvider: this.slotProvider, key })
      this.slidingWindows.set(key, newSlidingWindow)
      return newSlidingWindow
    }
  }
}

export class SlidingWindow {
  private readonly samplingPeriodSeconds: number
  private readonly rateLimit: number
  private readonly slots: Map<number, Slot> = new Map()
  private readonly nowSeconds: () => number
  private readonly slotProvider: SlotProvider
  private readonly key: string
  private rateLimitedUntil?: number

  constructor({
    rate,
    nowSeconds,
    slotProvider,
    key,
  }: {
    rate: Rate
    nowSeconds?: () => number
    slotProvider: SlotProvider
    key: string
  }) {
    if (rate.period < 1) {
      throw new Error('Sampling period must be at least 1 second')
    }
    if (rate.requests < 0) {
      throw new Error('Rate limit must be a positive duration')
    }
    this.samplingPeriodSeconds = rate.periodInSeconds
    this.rateLimit = rate.requests
    this.nowSeconds = nowSeconds ?? (() => new Date().getTime() / 1000.0)
    this.slotProvider = slotProvider
    this.key = key
  }

  private getSlots(): [Slot, Slot] {
    const now = this.nowSeconds()
    const actualFrom = Math.floor(now / this.samplingPeriodSeconds) * this.samplingPeriodSeconds
    const oldFrom = actualFrom - this.samplingPeriodSeconds

    const oldSlot =
      this.slots.get(oldFrom) ??
      this.slotProvider.create({
        fromSecond: oldFrom,
        durationSecond: this.samplingPeriodSeconds,
        key: this.key,
      })
    this.slots.set(oldFrom, oldSlot)
    const actualSlot =
      this.slots.get(actualFrom) ??
      this.slotProvider.create({
        fromSecond: actualFrom,
        durationSecond: this.samplingPeriodSeconds,
        key: this.key,
      })
    this.slots.set(actualFrom, actualSlot)

    //Remove expired slots reference
    if (this.slots.size > 2) {
      const slots = [...this.slots.values()].sort((slot1, slot2) => slot2.fromSecond - slot1.fromSecond)
      for (let i = 2; i < slots.length; i++) {
        this.slots.delete(slots[i].fromSecond)
      }
    }

    return [oldSlot, actualSlot]
  }

  inc(): 'allowed' | 'rate-limited' {
    const now = this.nowSeconds()
    if (this.rateLimitedUntil != null && now <= this.rateLimitedUntil) {
      return 'rate-limited'
    }
    this.rateLimitedUntil = undefined
    const [oldSlot, currentSlot] = this.getSlots()
    const oldValue = oldSlot.value()
    const currentValue = currentSlot.value()
    const oldPart = (this.samplingPeriodSeconds - (now - currentSlot.fromSecond)) / this.samplingPeriodSeconds
    const requests = currentValue + oldPart * oldValue
    if (requests < this.rateLimit) {
      currentSlot.inc()
      return 'allowed'
    }
    this.rateLimitedUntil =
      oldValue === 0
        ? currentSlot.fromSecond + this.samplingPeriodSeconds
        : ((currentValue - this.rateLimit) * this.samplingPeriodSeconds) / oldValue +
          this.samplingPeriodSeconds +
          currentSlot.fromSecond
    return 'rate-limited'
  }
}
