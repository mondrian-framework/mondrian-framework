/**
 * Slot provider.
 */
export interface SlotProvider {
  /**
   * Creates an active slot for the given period.
   */
  create(args: { fromSecond: number; durationSecond: number; key: string }): Slot
}

/**
 * Sliding window slot.
 */
export interface Slot {
  /**
   * Slot starting time.
   */
  readonly fromSecond: number
  /**
   * Increases slot internlal counter.
   */
  inc(): void
  /**
   * Gets slot internal counter.
   */
  value(): number
}
