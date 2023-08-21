import { arbitrary, types } from '../../src'
import { test } from '@fast-check/vitest'
import { expect } from 'vitest'

test.prop([arbitrary.type()])('A type is always equal to itself', (type) => {
  expect(types.areEqual(type, type)).toBe(true)
})
