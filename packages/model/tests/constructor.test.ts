import { model } from '../src'
import { expect, test } from 'vitest'

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
