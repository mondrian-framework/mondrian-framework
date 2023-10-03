import { areJsonsEquals } from '../src'
import { expect, test } from 'vitest'

test('areJsonsEquals', () => {
  expect(areJsonsEquals(1, 1)).toBe(true)
  expect(areJsonsEquals(1, 2)).toBe(false)
  expect(areJsonsEquals({}, {})).toBe(true)
  expect(areJsonsEquals({}, { a: undefined })).toBe(true)
  expect(areJsonsEquals({ a: undefined }, {})).toBe(true)
  expect(areJsonsEquals({ a: 1 }, { a: 1, b: undefined })).toBe(true)
  expect(areJsonsEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  expect(areJsonsEquals([], { a: 1, b: 2 })).toBe(false)
  expect(areJsonsEquals([], [])).toBe(true)
  expect(areJsonsEquals([1], [1])).toBe(true)
  expect(areJsonsEquals([1], [])).toBe(false)
  expect(areJsonsEquals([1], [2])).toBe(false)
})
