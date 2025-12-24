import { serve, rest } from '../src'
import { describe, test, expect } from 'vitest'

describe('index exports', () => {
  test('should export serve function', () => {
    expect(serve).toBeDefined()
    expect(typeof serve).toBe('function')
  })

  test('should re-export rest from @mondrian-framework/rest', () => {
    expect(rest).toBeDefined()
    expect(typeof rest).toBe('object')
    // Verify it has expected properties from the rest module
    expect(rest.define).toBeDefined()
    expect(rest.build).toBeDefined()
  })
})
