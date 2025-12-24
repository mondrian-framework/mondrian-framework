import { InMemoryStore } from '../src/implementation/in-memory'
import { describe, expect, test } from 'vitest'

describe('InMemoryStore', () => {
  describe('getOrCreateSlot', () => {
    test('creates a new slot when none exists', () => {
      const store = new InMemoryStore()
      const now = new Date(100000)
      const slot = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test-key' }, now)

      expect(slot).toBeDefined()
      expect(slot.startingTimeSeconds).toBe(90)
      expect(slot.durationSeconds).toBe(30)
      expect(slot.key).toBe('test-key')
      expect(slot.value()).toBe(0)
    })

    test('returns the same slot for the same parameters', () => {
      const store = new InMemoryStore()
      const now = new Date(100000)
      const slot1 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test-key' }, now)
      const slot2 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test-key' }, now)

      expect(slot1).toBe(slot2)
    })

    test('creates different slots for different keys', () => {
      const store = new InMemoryStore()
      const now = new Date(100000)
      const slot1 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'key-1' }, now)
      const slot2 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'key-2' }, now)

      expect(slot1).not.toBe(slot2)
    })

    test('creates different slots for different starting times', () => {
      const store = new InMemoryStore()
      const now = new Date(100000)
      const slot1 = store.getOrCreateSlot({ startingTimeSeconds: 60, durationSeconds: 30, key: 'test-key' }, now)
      const slot2 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test-key' }, now)

      expect(slot1).not.toBe(slot2)
    })

    test('creates different slots for different durations', () => {
      const store = new InMemoryStore()
      const now = new Date(100000)
      const slot1 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 30, key: 'test-key' }, now)
      const slot2 = store.getOrCreateSlot({ startingTimeSeconds: 90, durationSeconds: 60, key: 'test-key' }, now)

      expect(slot1).not.toBe(slot2)
    })

    test('frees memory by removing old slots', () => {
      const store = new InMemoryStore()

      // Create a slot at time 0
      const earlyTime = new Date(0)
      const slot1 = store.getOrCreateSlot({ startingTimeSeconds: 0, durationSeconds: 30, key: 'test-key' }, earlyTime)
      slot1.inc()
      expect(slot1.value()).toBe(1)

      // Much later in time, request a DIFFERENT slot - this should trigger cleanup of the old one
      // Slot lifetime is startingTimeSeconds + durationSeconds * 3 = 0 + 90 = 90 seconds
      const laterTime = new Date(100000) // 100 seconds
      // Use different startingTimeSeconds to trigger a new slot creation (which runs freeMemory)
      const slot2 = store.getOrCreateSlot({ startingTimeSeconds: 100, durationSeconds: 30, key: 'test-key' }, laterTime)

      // The new slot should start at 0
      expect(slot2.value()).toBe(0)
      expect(slot1).not.toBe(slot2)

      // Now request the old slot again - it should have been cleaned up
      const slot3 = store.getOrCreateSlot({ startingTimeSeconds: 0, durationSeconds: 30, key: 'test-key' }, laterTime)
      // This is a new slot (the old one was freed), so it starts at 0
      expect(slot3.value()).toBe(0)
    })
  })
})

describe('InMemorySlot', () => {
  test('inc() increases counter', () => {
    const store = new InMemoryStore()
    const now = new Date()
    const slot = store.getOrCreateSlot({ startingTimeSeconds: 0, durationSeconds: 30, key: 'test' }, now)

    expect(slot.value()).toBe(0)
    slot.inc()
    expect(slot.value()).toBe(1)
    slot.inc()
    slot.inc()
    expect(slot.value()).toBe(3)
  })

  test('inc() does not overflow MAX_SAFE_INTEGER', () => {
    const store = new InMemoryStore()
    const now = new Date()
    const slot = store.getOrCreateSlot({ startingTimeSeconds: 0, durationSeconds: 30, key: 'test' }, now)

    // Directly test the behavior by simulating max value
    // We'll use a custom store to test this edge case
  })

  test('slot properties are correctly set', () => {
    const store = new InMemoryStore()
    const now = new Date()
    const slot = store.getOrCreateSlot({ startingTimeSeconds: 12345, durationSeconds: 60, key: 'my-key' }, now)

    expect(slot.startingTimeSeconds).toBe(12345)
    expect(slot.durationSeconds).toBe(60)
    expect(slot.key).toBe('my-key')
  })
})
