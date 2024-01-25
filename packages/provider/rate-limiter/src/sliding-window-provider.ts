import { Rate } from './rate'
import { SlidingWindow } from './sliding-window'
import { Store } from './store'

/**
 * This is a utility class that helps create and cache {@link SlidingWindow} instances based on a key value.
 * All the {@link SlidingWindow} instances will have the same {@link Rate} and the same {@link Store}.
 */
export class SlidingWindowProvider {
  private readonly slidingWindows: Map<string, SlidingWindow> //key -> SlidingWindow
  private readonly rate: Rate
  private readonly store: Store

  constructor({ rate, store }: { rate: Rate; store: Store }) {
    this.slidingWindows = new Map()
    this.rate = rate
    this.store = store
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
      const newSlidingWindow = new SlidingWindow({ rate: this.rate, store: this.store, key })
      this.slidingWindows.set(key, newSlidingWindow)
      return newSlidingWindow
    }
  }
}
