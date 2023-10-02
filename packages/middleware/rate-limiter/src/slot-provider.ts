import { Slot } from './slot'

/**
 * This is a utility class that helps create and cache {@link Slot} instances based on the starting time, duration, and the key value.
 */
export abstract class SlotProvider {
  private readonly slots: Map<string, Slot> = new Map()
  /**
   * Creates an active slot for the given starting time and duration.
   * The key indicates which "temporal line" the slot belongs to.
   * Many slots can be created with the same keys but with different starting times.
   * @returns A new {@link Slot} instance.
   */
  protected abstract createSlot(args: { startingTimeSeconds: number; durationSeconds: number; key: string }): Slot

  getOrCreateSlot(args: { startingTimeSeconds: number; durationSeconds: number; key: string }, now: Date) {
    const index = this.getSlotIndexingKey(args)
    const slot = this.slots.get(index)
    if (slot) {
      return slot
    } else {
      this.freeMemory(now)
      const newSlot = this.createSlot(args)
      this.slots.set(index, newSlot)
      return newSlot
    }
  }

  /**
   * Removes all old slots to free memory, keeping only the active slots.
   */
  private freeMemory(now: Date) {
    const nowSeconds = now.getTime() / 1000.0
    //The useful time of a slots ends at startingTimeSeconds + durationSeconds * 2
    //To ensure safety we delete only after 3 times durationSeconds
    const slotsToBeRemoved = [...this.slots.values()].filter(
      (s) => s.startingTimeSeconds + s.durationSeconds * 3 < nowSeconds,
    )
    for (const slot of slotsToBeRemoved) {
      this.slots.delete(this.getSlotIndexingKey(slot))
    }
  }

  /**
   * Gets the unique indexing key of a slot.
   */
  private getSlotIndexingKey(args: { startingTimeSeconds: number; durationSeconds: number; key: string }) {
    return `${args.startingTimeSeconds}:${args.durationSeconds}:${args.key}`
  }
}
