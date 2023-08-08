import { result, types } from '../src'
import { expect } from 'vitest'

export function assertOk<A>(result: result.Result<A, any>): A {
  return result.match(
    (value) => value,
    (error) => expect.fail(`Expected an \`ok\` result but got a \`failure\` with error\n${error}`),
  )
}

export function assertFailure<E>(result: result.Result<any, E>): E {
  return result.match(
    (value) => expect.fail(`Expected a \`failure\` result but got an \`ok\` with value\n${value}`),
    (error) => error,
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