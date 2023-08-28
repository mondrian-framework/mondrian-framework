import { areSameArray, failWithInternalError, filterMap, filterMapObject } from '../src/utils'
import { expectToThrowErrorMatching } from './testing-utils'
import { fc as gen, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

describe.concurrent('filterMap', () => {
  const integerList = gen.array(gen.integer())
  test.prop([integerList])('behaves as a map followed by a filter', (list) => {
    const mapper = (x: number) => (x % 2 === 0 ? x : undefined)
    const actual = filterMap(list, mapper)
    const expected = list.map(mapper).filter((x) => x !== undefined)
    expect(actual).toEqual(expected)
  })
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

describe.concurrent('failWithInternalError', () => {
  test('throws when called', () => {
    expect(() => failWithInternalError('foo')).toThrowError(/.*\[internal error\].*/)
  })

  test.prop([gen.string({ minLength: 10 })])('has the given message', (message) => {
    expectToThrowErrorMatching(
      () => failWithInternalError(message),
      (error) => error.message.includes(message),
    )
  })

  const issuePage = 'https://github.com/twinlogix/mondrian-framework/issues'
  test('Reports the repo issue page', () => {
    expectToThrowErrorMatching(
      () => failWithInternalError('message'),
      (error) => error.message.includes(issuePage),
    )
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
