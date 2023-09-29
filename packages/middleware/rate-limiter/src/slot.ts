/**
 * A slot is a counter that keeps track of the number of requests in a specific time period (or time slot).
 * A new slot always starts at 0 and can only increase. The counter must always be kept in the interval [0, MAX_SAFE_INTEGER].
 * If it reaches MAX_SAFE_INTEGER, the `inc` operation should have no effect.
 */
export interface Slot {
  /**
   * Slot starting time in seconds.
   */
  readonly startingTimeSeconds: number

  /**
   * Increases the slot's internal counter value by one.
   * This operation could be asynchronous and may not instantly reflect the effect on the value.
   */
  inc(): void

  /**
   * Gets the slot internal counter value.
   * It could be an approximation if the underling implementation cannot guarantee 100% accuracy.
   * @returns The slot's internal counter value.
   */
  value(): number
}
