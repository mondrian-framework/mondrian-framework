import { result, model } from '../src'
import { expect } from 'vitest'

export function assertOk<A, E>(result: result.Result<A, E>): A {
  return result.match(
    (value) => value,
    (error) => expect.fail(`Expected an \`ok\` result but got a \`failure\` with error\n${JSON.stringify(error)}`),
  )
}

export function assertFailure<A, E>(
  result: result.Result<A, E>,
  prettyValue: (value: A) => string = (value) => JSON.stringify(value),
): E {
  return result.match(
    (value) => expect.fail(`Expected a \`failure\` result but got an \`ok\` with value\n${prettyValue(value)}`),
    (error) => error,
  )
}

export function expectSameTypes(t1: model.Type, t2: model.Type): void {
  expect(model.areEqual(t1, t2)).toBe(true)
}
