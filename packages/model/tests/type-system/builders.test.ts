import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { model } from '../../src'

//TODO [Good first issue]: test other types constructor

describe('type contructor', () => {
  test('object invalid fields', () => {
    expect(() => model.object({ constructor: model.string() })).toThrowError(
      'Forbidden field name on object: constructor',
    )

    expect(() => model.object(Object.fromEntries([['__proto__', model.string()]]))).toThrowError(
      'Forbidden field name on object: __proto__',
    )
  })

  test('number invalid options', () => {
    expect(() => model.integer({ exclusiveMinimum: 1, exclusiveMaximum: 2 })).toThrowError(
      'If both lower bound and upper bound are enabled on integer types the minimum difference between the two bounds must be grater than 1',
    )
    expect(() => model.integer({ minimum: 1, maximum: 0.99 })).toThrowError()
    expect(() => model.integer({ minimum: 1, exclusiveMaximum: 1 })).toThrowError()
    expect(() => model.integer({ exclusiveMinimum: 1, maximum: 1 })).toThrowError()
    expect(model.integer({ exclusiveMinimum: 0.5, minimum: 1, maximum: 1 })).toBeTruthy()
    expect(() => model.integer({ minimum: 1, maximum: 1.99 })).toThrowError()
  })
})
