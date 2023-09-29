import { Slot } from './slot'

/**
 * This is a utility class that helps create new {@link Slot} instances based on the starting time, duration, and a key value.
 */
export interface SlotProvider {
  /**
   * Creates an active slot for the given starting time and duration.
   * The key indicates which "temporal line" the slot belongs to.
   * Many slots can be created with the same keys but with different starting times.
   * @returns A new {@link Slot} instance.
   */
  create(args: { startingTimeSeconds: number; durationSeconds: number; key: string }): Slot
}
