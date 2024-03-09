import {
  areJsonsEquals,
  areSameArray,
  assertNever,
  buildErrorMessage,
  capitalise,
  deepMerge,
  filterMapObject,
  flatMapObject,
  groupBy,
  isArray,
  mapObject,
  setTraversingValue,
  sleep,
  toCamelCase,
  uncapitalise,
} from '../src'
import { fc as gen, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

test('assertNever', () => {
  expect(() => assertNever(1 as never, 'message')).toThrowError(
    'Mondrian-Framework internal error] message\nIf you think this could be a bug in the framework, please report it at https://github.com/mondrian-framework/mondrian-framework/issues',
  )

  expect(buildErrorMessage('message', '23')).toBe(
    '[Mondrian-Framework internal error] message\n(at 23)\nIf you think this could be a bug in the framework, please report it at https://github.com/mondrian-framework/mondrian-framework/issues',
  )
})

test('setTraversingValue', () => {
  const obj = {}
  setTraversingValue(1, 'a', obj)
  expect(obj).toStrictEqual({ a: 1 })
  setTraversingValue(1, 'b.a', obj)
  expect(obj).toStrictEqual({ a: 1, b: { a: 1 } })
  setTraversingValue(1, 'b.a.a', obj)
  expect(obj).toStrictEqual({ a: 1, b: { a: { a: 1 } } })
  setTraversingValue(1, 'b.a', obj)
  expect(obj).toStrictEqual({ a: 1, b: { a: 1 } })
})

test('sleep', async () => {
  const start = new Date()
  await sleep(100)
  expect(new Date().getTime() - start.getTime()).toBeGreaterThan(50)
})

test('deepMerge', async () => {
  expect(deepMerge({ a: 1 }, { a: 2 })).toStrictEqual({ a: 2 })
  expect(deepMerge(1, { a: 2 })).toStrictEqual({ a: 2 })
  expect(deepMerge(undefined, 1)).toStrictEqual(1)
  expect(deepMerge(1, undefined)).toStrictEqual(1)
  expect(deepMerge({ a: 2 }, { b: 1 })).toStrictEqual({ a: 2, b: 1 })
})

test('isArray', async () => {
  expect(isArray([])).toBe(true)
})

describe.concurrent('filterMapObject', () => {
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

describe.concurrent('mapObject', () => {
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

describe.concurrent('flatMapObject', () => {
  test.prop([gen.dictionary(gen.string(), gen.integer())])('behaves as a map', (object) => {
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

describe.concurrent('areSameArray', () => {
  test('is false for arrays with different size', () => {
    expect(areSameArray([1], [1, 2, 3], (n, m) => n === m)).toBe(false)
    expect(areSameArray([1, 2, 3], [1], (n, m) => n === m)).toBe(false)
  })

  test('is false for arrays with different elements', () => {
    expect(areSameArray([1, 2, 3], [1, 2, 4], (n, m) => n === m)).toBe(false)
    expect(areSameArray(['1'], ['2'], (n, m) => n === m)).toBe(false)
  })

  test('is true for arrays that are equal element by element', () => {
    expect(areSameArray([1, 2, 3], [1, 2, 3], (n, m) => n === m)).toBe(true)
    expect(areSameArray(['1'], ['1'], (n, m) => n === m)).toBe(true)
  })
})

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

test('capitalize', () => {
  expect(capitalise('asd')).toBe('Asd')
  expect(capitalise('')).toBe('')
  expect(capitalise('.')).toBe('.')
})

test('capitalize', () => {
  expect(uncapitalise('Asd')).toBe('asd')
  expect(uncapitalise('')).toBe('')
  expect(uncapitalise('.')).toBe('.')
})

test('toCamelCase', () => {
  expect(toCamelCase('hello world')).toBe('HelloWorld')
  expect(toCamelCase('')).toBe('')
  expect(toCamelCase('.')).toBe('.')
})

test('toCamelCase', () => {
  expect(groupBy([{ a: 1, b: 1 }, { a: 2 }, { a: 1 }], (i) => i.a.toString())).toStrictEqual({
    '1': [{ a: 1, b: 1 }, { a: 1 }],
    '2': [{ a: 2 }],
  })
})
