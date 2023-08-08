import { result, types } from '../src'
import { expect } from 'vitest'

export function expectOk<A>(result: result.Result<A, any>, expected: A, compare?: (one: A, other: A) => boolean): void {
  result.match(
    (actual) => (compare ? expect(compare(actual, expected)).toBe(true) : expect(actual).toBe(expected)),
    (error) => expect.fail(`Expected an \`ok\` result but got a \`failure\` with error\n${error}`),
  )
}

export function expectFailure<E>(
  result: result.Result<any, E>,
  expected: E,
  compare?: (one: E, other: E) => boolean,
): void {
  result.match(
    (value) => expect.fail(`Expected a \`failure\` result but got an \`ok\` with value\n${value}`),
    (actual) => (compare ? expect(compare(actual, expected)).toBe(true) : expect(actual).toEqual(expected)),
  )
}

export function expectSameTypes(t1: types.Type, t2: types.Type): void {
  expect(types.areEqual(t1, t2)).toBe(true)
}

export function expectToThrowErrorMatching(f: () => any, predicate: (error: Error) => boolean): void {
  try {
    f()
  } catch (error) {
    if (error instanceof Error) {
      if (!predicate(error)) {
        expect.fail(`The thrown \`Error\` did not match the given predicate. Error is:\n${error.toString()}`)
      }
    } else {
      expect.fail('The given function did throw an exception but it was not an `Error`')
    }
    return
  }
  expect.fail("The given function didn't throw an exception")
}
