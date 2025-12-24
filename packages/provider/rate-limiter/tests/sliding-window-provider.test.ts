import { InMemoryStore } from '../src/implementation/in-memory'
import { Rate } from '../src/rate'
import { SlidingWindowProvider } from '../src/sliding-window-provider'
import { describe, expect, test } from 'vitest'

describe('SlidingWindowProvider', () => {
  describe('constructor', () => {
    test('creates provider with rate and store', () => {
      const rate = new Rate({ requests: 10, period: 30, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      expect(provider).toBeDefined()
    })
  })

  describe('getOrCreateSlidingWindow', () => {
    test('creates new sliding window for new key', () => {
      const rate = new Rate({ requests: 10, period: 30, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      const window = provider.getOrCreateSlidingWindow('user-1')
      expect(window).toBeDefined()
    })

    test('returns same sliding window for same key', () => {
      const rate = new Rate({ requests: 10, period: 30, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      const window1 = provider.getOrCreateSlidingWindow('user-1')
      const window2 = provider.getOrCreateSlidingWindow('user-1')

      expect(window1).toBe(window2)
    })

    test('creates different sliding windows for different keys', () => {
      const rate = new Rate({ requests: 10, period: 30, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      const window1 = provider.getOrCreateSlidingWindow('user-1')
      const window2 = provider.getOrCreateSlidingWindow('user-2')

      expect(window1).not.toBe(window2)
    })

    test('each window has independent rate limiting', () => {
      const rate = new Rate({ requests: 2, period: 60, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      const now = new Date(100000)
      const window1 = provider.getOrCreateSlidingWindow('user-1')
      const window2 = provider.getOrCreateSlidingWindow('user-2')

      // Use up user-1's rate limit
      expect(window1.isRateLimited(now)).toBe('allowed')
      expect(window1.isRateLimited(now)).toBe('allowed')
      expect(window1.isRateLimited(now)).toBe('rate-limited')

      // user-2 should still be allowed
      expect(window2.isRateLimited(now)).toBe('allowed')
      expect(window2.isRateLimited(now)).toBe('allowed')
      expect(window2.isRateLimited(now)).toBe('rate-limited')
    })

    test('handles empty string key', () => {
      const rate = new Rate({ requests: 10, period: 30, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      const window = provider.getOrCreateSlidingWindow('')
      expect(window).toBeDefined()
    })

    test('handles special characters in key', () => {
      const rate = new Rate({ requests: 10, period: 30, scale: 'second' })
      const store = new InMemoryStore()
      const provider = new SlidingWindowProvider({ rate, store })

      const window1 = provider.getOrCreateSlidingWindow('user:123:action')
      const window2 = provider.getOrCreateSlidingWindow('user/path/to/resource')
      const window3 = provider.getOrCreateSlidingWindow('192.168.1.1')

      expect(window1).toBeDefined()
      expect(window2).toBeDefined()
      expect(window3).toBeDefined()
      expect(window1).not.toBe(window2)
      expect(window2).not.toBe(window3)
    })
  })
})
