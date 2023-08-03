import { failWithInternalError, filterMap, filterMapObject } from '../src/utils'
import { expectToThrowErrorMatching } from './testing-utils'
import { fc as gen, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

describe('filterMap', () => {
  const integerList = gen.array(gen.integer())
  test.prop([integerList])('behaves as a map followed by a filter', (list) => {
    const mapper = (x: number) => (x % 2 === 0 ? x : undefined)
    const actual = filterMap(list, mapper)
    const expected = list.map(mapper).filter((x) => x !== undefined)
    expect(actual).toEqual(expected)
  })
})

describe('filterMapObject', () => {
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

describe('failWithInternalError', () => {
  test('throws when called', () => {
    expect(() => failWithInternalError('foo')).toThrowError()
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
