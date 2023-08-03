import { result, types } from '../src'
import { expect } from 'vitest'

export function expectOk<A>(result: result.Result<A, any>, expected: A) {
  result.match(
    (actual) => expect(actual).toBe(expected),
    (error) => expect.fail(`Expected an \`ok\` result but got a \`failure\` with error\n${error}`),
  )
}

export function expectFailure<E>(result: result.Result<any, E>, expected: E) {
  result.match(
    (value) => expect.fail(`Expected a \`failure\` result but got an \`ok\` with value\n${value}`),
    (actual) => expect(actual).toBe(expected),
  )
}

export function expectSameTypes(t1: types.Type, t2: types.Type): void {
  expect(types.areEqual(t1, t2)).toBe(true)
}
