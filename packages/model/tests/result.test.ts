import { result } from '../src/index'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

function expectOk<A>(result: result.Result<A, any>, expected: A) {
  result.match(
    (actual) => expect(actual).toBe(expected),
    (error) => expect.fail(`Expected an \`ok\` result but got a \`failure\` with error\n${error}`),
  )
}

function expectFailure<E>(result: result.Result<any, E>, expected: E) {
  result.match(
    (value) => expect.fail(`Expected a \`failure\` result but got an \`ok\` with value\n${value}`),
    (actual) => expect(actual).toBe(expected),
  )
}

describe('chain', () => {
  test('short circuits on error values', () =>
    expectFailure(
      result.fail('error').then((_) => expect.fail()),
      'error',
    ))

  test('returns callback result on ok values', () => {
    expectOk(
      result.ok(1).then((n) => result.ok(n + 1)),
      2,
    )

    expectFailure(
      result.ok<number, string>(1).then((_) => result.fail('error')),
      'error',
    )
  })
})

describe('map', () => {
  test('changes the success value', () =>
    expectOk(
      result.ok(1).map((n) => n + 1),
      2,
    ))
  test('leaves the error unchanged', () =>
    expectFailure(
      result.fail('error').map((_) => expect.fail()),
      'error',
    ))
})

describe('mapError', () => {
  test('leaves the success value unchanged', () =>
    expectOk(
      result.ok(1).mapError((_) => expect.fail()),
      1,
    ))

  test('changes the error value', () =>
    expectFailure(
      result.fail(1).mapError((n) => n + 1),
      2,
    ))
})

describe('replace', () => {
  test('replaces the success value', () => expectOk(result.ok(1).replace(2), 2))
  test('leaves the error unchanged', () => expectFailure(result.fail('error').replace(2), 'error'))
})

describe('unwrap', () => {
  test('returns value if called on ok value', () => expect(result.ok(1).unwrap(0)).toBe(1))
  test('returns fallback if called on failure value', () => expect(result.fail('error').unwrap(1)).toBe(1))
})

describe('lazyUnwrap', () => {
  test('returns value if called on ok value', () => expect(result.ok(1).lazyUnwrap(() => expect.fail())).toBe(1))
  test('returns fallback if called on failure value', () => expect(result.fail('error').lazyUnwrap(() => 1)).toBe(1))
})

describe('or', () => {
  test('returns second result if called on failure value', () => expectOk(result.fail('error').or(result.ok(1)), 1))
  test('returns first result if called on ok value', () => expectOk(result.ok(1).or(result.fail('a')), 1))
})

describe('lazyOr', () => {
  test('returns second result if called on failure value', () =>
    expectOk(
      result.fail('error').lazyOr(() => result.ok(1)),
      1,
    ))
  test('returns first result if called on ok value', () =>
    expectOk(
      result.ok(1).lazyOr(() => expect.fail()),
      1,
    ))
})

describe('match', () => {
  test('calls first function when called on ok value', () =>
    result.ok(1).match(
      (_) => {},
      (_) => expect.fail(),
    ))

  test('calls second function when called on failure value', () =>
    result.fail('error').match(
      (_) => expect.fail(),
      (_) => {},
    ))
})
