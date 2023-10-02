import { Rate } from './rate'
import { SlidingWindow } from './sliding-window'
import { SlotProvider } from './slot-provider'

/**
 * This is a utility class that helps create and cache {@link SlidingWindow} instances based on a key value.
 * All the {@link SlidingWindow} instances will have the same {@link Rate} and the same {@link SlotProvider}.
 */
export class SlidingWindowProvider {
  private readonly slidingWindows: Map<string, SlidingWindow> //key -> SlidingWindow
  private readonly rate: Rate
  private readonly slotProvider: SlotProvider

  constructor({ rate, slotProvider }: { rate: Rate; slotProvider: SlotProvider }) {
    this.slidingWindows = new Map()
    this.rate = rate
    this.slotProvider = slotProvider
  }

  /**
   * Gets or creates a {@link SlidingWindow}.
   * @param key the unique key referencing the {@link SlidingWindow}
   * @returns the {@link SlidingWindow} referenced by this key.
   */
  getOrCreateSlidingWindow(key: string): SlidingWindow {
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
