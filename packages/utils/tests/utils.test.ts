import {
  areJsonsEquals,
  areSameArray,
  assertNever,
  buildErrorMessage,
  capitalise,
  deepMerge,
  failWithInternalError,
  filterMapObject,
  flatMapObject,
  groupBy,
  isArray,
  isPlainObject,
  mapObject,
  replaceLast,
  reverseStr,
  setTraversingValue,
  sleep,
  toCamelCase,
  uncapitalise,
} from '../src'
import { fc as gen, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'

// ============================================================================
// Error Handling Functions
// ============================================================================

describe('failWithInternalError', () => {
  it('throws an error with proper formatting', () => {
    expect(() => failWithInternalError('test error')).toThrowError(
      '[Mondrian-Framework internal error] test error\nIf you think this could be a bug in the framework, please report it at https://github.com/mondrian-framework/mondrian-framework/issues',
    )
  })
})

describe('buildErrorMessage', () => {
  it('builds error message without location', () => {
    expect(buildErrorMessage('message')).toBe(
      '[Mondrian-Framework internal error] message\nIf you think this could be a bug in the framework, please report it at https://github.com/mondrian-framework/mondrian-framework/issues',
    )
  })

  it('builds error message with location', () => {
    expect(buildErrorMessage('message', 'file.ts:23')).toBe(
      '[Mondrian-Framework internal error] message\n(at file.ts:23)\nIf you think this could be a bug in the framework, please report it at https://github.com/mondrian-framework/mondrian-framework/issues',
    )
  })
})

describe('assertNever', () => {
  it('throws an internal error when called', () => {
    expect(() => assertNever(1 as never, 'unexpected value')).toThrowError(
      'Mondrian-Framework internal error] unexpected value',
    )
  })
})

// ============================================================================
// setTraversingValue
// ============================================================================

describe('setTraversingValue', () => {
  it('sets a single level value', () => {
    const obj: Record<string, unknown> = {}
    setTraversingValue(1, 'a', obj)
    expect(obj).toStrictEqual({ a: 1 })
  })

  it('sets a nested value creating intermediate objects', () => {
    const obj: Record<string, unknown> = {}
    setTraversingValue(1, 'b.a', obj)
    expect(obj).toStrictEqual({ b: { a: 1 } })
  })

  it('overwrites non-object values with objects when traversing', () => {
    const obj: Record<string, unknown> = { b: { a: 1 } }
    setTraversingValue(1, 'b.a.a', obj)
    expect(obj).toStrictEqual({ b: { a: { a: 1 } } })
  })

  it('overwrites deeply nested values', () => {
    const obj: Record<string, unknown> = { a: 1, b: { a: { a: 1 } } }
    setTraversingValue(1, 'b.a', obj)
    expect(obj).toStrictEqual({ a: 1, b: { a: 1 } })
  })

  it('handles deeply nested paths', () => {
    const obj: Record<string, unknown> = {}
    setTraversingValue('value', 'a.b.c.d.e', obj)
    expect(obj).toStrictEqual({ a: { b: { c: { d: { e: 'value' } } } } })
  })

  it('handles null intermediate values', () => {
    const obj: Record<string, unknown> = { a: null }
    setTraversingValue(1, 'a.b', obj)
    expect(obj).toStrictEqual({ a: { b: 1 } })
  })
})

// ============================================================================
// sleep
// ============================================================================

describe('sleep', () => {
  it('resolves after the specified time', async () => {
    const start = Date.now()
    await sleep(100)
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })

  it('resolves immediately for 0ms', async () => {
    const start = Date.now()
    await sleep(0)
    expect(Date.now() - start).toBeLessThan(50)
  })
})

// ============================================================================
// deepMerge
// ============================================================================

describe('deepMerge', () => {
  it('returns strong when weak is undefined', () => {
    expect(deepMerge(undefined, 1)).toStrictEqual(1)
    expect(deepMerge(undefined, { a: 1 })).toStrictEqual({ a: 1 })
  })

  it('returns weak when strong is undefined', () => {
    expect(deepMerge(1, undefined)).toStrictEqual(1)
    expect(deepMerge({ a: 1 }, undefined)).toStrictEqual({ a: 1 })
  })

  it('overrides weak with strong for non-objects', () => {
    expect(deepMerge(1, 2)).toStrictEqual(2)
    expect(deepMerge('a', 'b')).toStrictEqual('b')
    expect(deepMerge(1, { a: 2 })).toStrictEqual({ a: 2 })
    expect(deepMerge({ a: 1 }, 2)).toStrictEqual(2)
  })

  it('merges two objects shallowly', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toStrictEqual({ a: 1, b: 2 })
    expect(deepMerge({ a: 1 }, { a: 2 })).toStrictEqual({ a: 2 })
  })

  it('merges nested objects recursively', () => {
    expect(deepMerge({ a: { b: 1 } }, { a: { c: 2 } })).toStrictEqual({ a: { b: 1, c: 2 } })
    expect(deepMerge({ a: { b: 1 } }, { a: { b: 2 } })).toStrictEqual({ a: { b: 2 } })
  })

  it('handles arrays (non-plain objects) by overriding', () => {
    expect(deepMerge([1, 2], [3, 4])).toStrictEqual([3, 4])
    expect(deepMerge({ a: [1] }, { a: [2] })).toStrictEqual({ a: [2] })
  })

  it('handles null values', () => {
    expect(deepMerge(null, { a: 1 })).toStrictEqual({ a: 1 })
    expect(deepMerge({ a: 1 }, null)).toStrictEqual(null)
  })
})

// ============================================================================
// isArray
// ============================================================================

describe('isArray', () => {
  it('returns true for arrays', () => {
    expect(isArray([])).toBe(true)
    expect(isArray([1, 2, 3])).toBe(true)
    expect(isArray(new Array(5))).toBe(true)
  })

  it('returns false for non-arrays', () => {
    expect(isArray({})).toBe(false)
    expect(isArray('array')).toBe(false)
    expect(isArray(123)).toBe(false)
    expect(isArray(null)).toBe(false)
    expect(isArray(undefined)).toBe(false)
  })
})

// ============================================================================
// isPlainObject
// ============================================================================

describe('isPlainObject', () => {
  it('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it('returns false for non-plain objects', () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject('string')).toBe(false)
    expect(isPlainObject(123)).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(() => {})).toBe(false)
  })

  it('returns false for class instances', () => {
    class TestClass {}
    expect(isPlainObject(new TestClass())).toBe(false)
  })

  it('returns false for objects with modified prototype', () => {
    // Object with constructor but modified prototype that is not an object
    const obj = Object.create({})
    Object.defineProperty(obj, 'constructor', {
      value: function () {},
      writable: true,
      configurable: true,
    })
    // The prototype of the constructor is a function, not an object
    obj.constructor.prototype = null
    expect(isPlainObject(obj)).toBe(false)
  })
})

// ============================================================================
// filterMapObject
// ============================================================================

describe('filterMapObject', () => {
  it('maps and filters object entries', () => {
    const result = filterMapObject({ a: 1, b: 2, c: 3 }, (_, v) => (v % 2 === 0 ? v * 2 : undefined))
    expect(result).toEqual({ b: 4 })
  })

  it('returns empty object when all entries are filtered out', () => {
    const result = filterMapObject({ a: 1, b: 3, c: 5 }, (_, v) => (v % 2 === 0 ? v : undefined))
    expect(result).toEqual({})
  })

  it('returns all entries when none are filtered', () => {
    const result = filterMapObject({ a: 2, b: 4 }, (_, v) => v * 2)
    expect(result).toEqual({ a: 4, b: 8 })
  })

  it('handles empty objects', () => {
    const result = filterMapObject({}, () => 1)
    expect(result).toEqual({})
  })

  test.prop([gen.dictionary(gen.string(), gen.integer())])('behaves as a map followed by a filter', (object) => {
    const mapper = (_fieldName: string, fieldValue: number) => (fieldValue % 2 === 0 ? fieldValue : undefined)
    const filterMappedEntries = Object.entries(object)
      .map(([fieldName, fieldValue]) => [fieldName, mapper(fieldName, fieldValue)])
      .filter(([_fieldName, fieldValue]) => fieldValue !== undefined)
    const expected = Object.fromEntries(filterMappedEntries)
    const actual = filterMapObject(object, mapper)
    expect(actual).toEqual(expected)
  })
})

// ============================================================================
// mapObject
// ============================================================================

describe('mapObject', () => {
  it('maps object values', () => {
    const result = mapObject({ a: 1, b: 2 }, (_, v) => v * 2)
    expect(result).toEqual({ a: 2, b: 4 })
  })

  it('handles empty objects', () => {
    const result = mapObject({}, () => 1)
    expect(result).toEqual({})
  })

  it('provides field name to mapper', () => {
    const result = mapObject({ a: 1, b: 2 }, (name) => name.toUpperCase())
    expect(result).toEqual({ a: 'A', b: 'B' })
  })

  test.prop([gen.dictionary(gen.string(), gen.integer())])('behaves as a map', (object) => {
    const mapper = (_fieldName: string, fieldValue: number) => (fieldValue % 2 === 0 ? fieldValue : undefined)
    const mappedEntries = Object.entries(object).map(([fieldName, fieldValue]) => [
      fieldName,
      mapper(fieldName, fieldValue),
    ])
    const expected = Object.fromEntries(mappedEntries)
    const actual = mapObject(object, mapper)
    expect(actual).toEqual(expected)
  })
})

// ============================================================================
// flatMapObject
// ============================================================================

describe('flatMapObject', () => {
  it('flat maps object entries', () => {
    const result = flatMapObject({ a: 1, b: 2 }, (name, value) => [
      [`${name}_1`, value],
      [`${name}_2`, value * 2],
    ])
    expect(result).toEqual({ a_1: 1, a_2: 2, b_1: 2, b_2: 4 })
  })

  it('handles empty result arrays', () => {
    const result = flatMapObject({ a: 1, b: 2 }, () => [])
    expect(result).toEqual({})
  })

  it('handles empty objects', () => {
    const result = flatMapObject({}, () => [['x', 1]])
    expect(result).toEqual({})
  })

  test.prop([gen.dictionary(gen.string(), gen.integer())])('behaves as a flatMap', (object) => {
    const mapper = (fieldName: string, fieldValue: number) =>
      fieldValue % 2 === 0 ? [[fieldName, fieldValue] as const] : []
    const filterMappedEntries = Object.entries(object).flatMap(([fieldName, fieldValue]) =>
      mapper(fieldName, fieldValue),
    )
    const expected = Object.fromEntries(filterMappedEntries)
    const actual = flatMapObject(object, mapper)
    expect(actual).toEqual(expected)
  })
})

// ============================================================================
// areSameArray
// ============================================================================

describe('areSameArray', () => {
  it('returns true for the same array reference', () => {
    const arr = [1, 2, 3]
    expect(areSameArray(arr, arr, (n, m) => n === m)).toBe(true)
  })

  it('returns true for empty arrays', () => {
    expect(areSameArray([], [], (n, m) => n === m)).toBe(true)
  })

  it('returns false for arrays with different size', () => {
    expect(areSameArray([1], [1, 2, 3], (n, m) => n === m)).toBe(false)
    expect(areSameArray([1, 2, 3], [1], (n, m) => n === m)).toBe(false)
  })

  it('returns false for arrays with different elements', () => {
    expect(areSameArray([1, 2, 3], [1, 2, 4], (n, m) => n === m)).toBe(false)
    expect(areSameArray(['1'], ['2'], (n, m) => n === m)).toBe(false)
  })

  it('returns true for arrays that are equal element by element', () => {
    expect(areSameArray([1, 2, 3], [1, 2, 3], (n, m) => n === m)).toBe(true)
    expect(areSameArray(['1'], ['1'], (n, m) => n === m)).toBe(true)
  })

  it('uses custom comparator function', () => {
    const arr1 = [{ id: 1 }, { id: 2 }]
    const arr2 = [{ id: 1 }, { id: 2 }]
    expect(areSameArray(arr1, arr2, (a, b) => a.id === b.id)).toBe(true)
  })
})

// ============================================================================
// areJsonsEquals
// ============================================================================

describe('areJsonsEquals', () => {
  describe('primitives', () => {
    it('returns true for equal primitives', () => {
      expect(areJsonsEquals(1, 1)).toBe(true)
      expect(areJsonsEquals('a', 'a')).toBe(true)
      expect(areJsonsEquals(true, true)).toBe(true)
      expect(areJsonsEquals(null, null)).toBe(true)
    })

    it('returns false for different primitives', () => {
      expect(areJsonsEquals(1, 2)).toBe(false)
      expect(areJsonsEquals('a', 'b')).toBe(false)
      expect(areJsonsEquals(true, false)).toBe(false)
      expect(areJsonsEquals(null, 1)).toBe(false)
    })
  })

  describe('arrays', () => {
    it('returns true for equal arrays', () => {
      expect(areJsonsEquals([], [])).toBe(true)
      expect(areJsonsEquals([1], [1])).toBe(true)
      expect(areJsonsEquals([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(areJsonsEquals([[1], [2]], [[1], [2]])).toBe(true)
    })

    it('returns false for different arrays', () => {
      expect(areJsonsEquals([1], [])).toBe(false)
      expect(areJsonsEquals([1], [2])).toBe(false)
      expect(areJsonsEquals([1, 2], [2, 1])).toBe(false)
    })

    it('returns false when comparing array with object', () => {
      expect(areJsonsEquals([], { a: 1, b: 2 })).toBe(false)
      // Note: [1] and { '0': 1 } are considered equal because arrays are objects in JS
      // and the function compares their JSON representation
    })
  })

  describe('objects', () => {
    it('returns true for equal objects', () => {
      expect(areJsonsEquals({}, {})).toBe(true)
      expect(areJsonsEquals({ a: 1 }, { a: 1 })).toBe(true)
      expect(areJsonsEquals({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
    })

    it('returns false for different objects', () => {
      expect(areJsonsEquals({ a: 1 }, { a: 2 })).toBe(false)
      expect(areJsonsEquals({ a: 1 }, { b: 1 })).toBe(false)
      expect(areJsonsEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })

    it('handles undefined values correctly', () => {
      expect(areJsonsEquals({}, { a: undefined })).toBe(true)
      expect(areJsonsEquals({ a: undefined }, {})).toBe(true)
      expect(areJsonsEquals({ a: 1 }, { a: 1, b: undefined })).toBe(true)
      expect(areJsonsEquals({ a: undefined }, { a: 1 })).toBe(false)
    })
  })

  describe('mixed types', () => {
    it('returns false for different types', () => {
      expect(areJsonsEquals(1, '1')).toBe(false)
      expect(areJsonsEquals({}, null)).toBe(false)
      expect(areJsonsEquals([], null)).toBe(false)
    })
  })
})

// ============================================================================
// capitalise
// ============================================================================

describe('capitalise', () => {
  it('capitalizes the first letter', () => {
    expect(capitalise('asd')).toBe('Asd')
    expect(capitalise('hello')).toBe('Hello')
    expect(capitalise('world')).toBe('World')
  })

  it('handles empty string', () => {
    expect(capitalise('')).toBe('')
  })

  it('handles single character', () => {
    expect(capitalise('a')).toBe('A')
    expect(capitalise('.')).toBe('.')
  })

  it('handles already capitalized strings', () => {
    expect(capitalise('Hello')).toBe('Hello')
  })
})

// ============================================================================
// uncapitalise
// ============================================================================

describe('uncapitalise', () => {
  it('uncapitalizes the first letter', () => {
    expect(uncapitalise('Asd')).toBe('asd')
    expect(uncapitalise('Hello')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(uncapitalise('')).toBe('')
  })

  it('handles single character', () => {
    expect(uncapitalise('A')).toBe('a')
    expect(uncapitalise('.')).toBe('.')
  })

  it('handles already uncapitalized strings', () => {
    expect(uncapitalise('hello')).toBe('hello')
  })
})

// ============================================================================
// toCamelCase
// ============================================================================

describe('toCamelCase', () => {
  it('converts space-separated words to CamelCase', () => {
    expect(toCamelCase('hello world')).toBe('HelloWorld')
    expect(toCamelCase('foo bar baz')).toBe('FooBarBaz')
  })

  it('handles single word', () => {
    expect(toCamelCase('hello')).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(toCamelCase('')).toBe('')
  })

  it('handles special characters', () => {
    expect(toCamelCase('.')).toBe('.')
  })

  it('handles multiple spaces', () => {
    expect(toCamelCase('hello  world')).toBe('HelloWorld')
  })
})

// ============================================================================
// groupBy
// ============================================================================

describe('groupBy', () => {
  it('groups items by key', () => {
    const result = groupBy([{ a: 1, b: 1 }, { a: 2 }, { a: 1 }], (i) => i.a.toString())
    expect(result).toStrictEqual({
      '1': [{ a: 1, b: 1 }, { a: 1 }],
      '2': [{ a: 2 }],
    })
  })

  it('handles empty array', () => {
    const result = groupBy([], (i: { a: number }) => i.a.toString())
    expect(result).toStrictEqual({})
  })

  it('handles single item', () => {
    const result = groupBy([{ type: 'a' }], (i) => i.type)
    expect(result).toStrictEqual({ a: [{ type: 'a' }] })
  })

  it('handles all items in same group', () => {
    const result = groupBy([1, 2, 3], () => 'all')
    expect(result).toStrictEqual({ all: [1, 2, 3] })
  })

  it('handles each item in different group', () => {
    const result = groupBy(['a', 'b', 'c'], (x) => x)
    expect(result).toStrictEqual({ a: ['a'], b: ['b'], c: ['c'] })
  })
})

// ============================================================================
// reverseStr
// ============================================================================

describe('reverseStr', () => {
  it('reverses a string', () => {
    expect(reverseStr('hello')).toBe('olleh')
    expect(reverseStr('abc')).toBe('cba')
  })

  it('handles empty string', () => {
    expect(reverseStr('')).toBe('')
  })

  it('handles single character', () => {
    expect(reverseStr('a')).toBe('a')
  })

  it('handles palindrome', () => {
    expect(reverseStr('racecar')).toBe('racecar')
  })

  it('handles unicode characters', () => {
    expect(reverseStr('🎉👍')).toBe('👍🎉')
  })
})

// ============================================================================
// replaceLast
// ============================================================================

describe('replaceLast', () => {
  it('replaces the last occurrence of a string', () => {
    expect(replaceLast('hello hello world', 'hello', 'bye')).toBe('hello bye world')
    expect(replaceLast('aaa', 'a', 'b')).toBe('aab')
  })

  it('handles string not found', () => {
    expect(replaceLast('hello world', 'foo', 'bar')).toBe('hello world')
  })

  it('handles empty strings', () => {
    expect(replaceLast('', 'a', 'b')).toBe('')
    expect(replaceLast('hello', '', 'x')).toBe('hellox')
  })

  it('handles single occurrence', () => {
    expect(replaceLast('hello world', 'world', 'there')).toBe('hello there')
  })

  it('handles replacement with empty string', () => {
    expect(replaceLast('hello world', 'world', '')).toBe('hello ')
  })
})
