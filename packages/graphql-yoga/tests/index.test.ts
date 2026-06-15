import { createServer, serveWithFastify, graphql } from '../src/index'
import { describe, expect, test } from 'vitest'

describe('index exports', () => {
  test('should export createServer function', () => {
    expect(createServer).toBeDefined()
    expect(typeof createServer).toBe('function')
  })

  test('should export serveWithFastify function', () => {
    expect(serveWithFastify).toBeDefined()
    expect(typeof serveWithFastify).toBe('function')
  })

  test('should re-export graphql namespace from @mondrian-framework/graphql', () => {
    expect(graphql).toBeDefined()
    expect(typeof graphql).toBe('object')
    expect(typeof graphql.build).toBe('function')
    expect(typeof graphql.define).toBe('function')
    expect(typeof graphql.fromModule).toBe('function')
    expect(graphql.DEFAULT_SERVE_OPTIONS).toBeDefined()
  })
})
