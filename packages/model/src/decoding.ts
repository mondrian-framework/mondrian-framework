import { decoding, result, path } from './index'

/**
 * The options that can be used when decoding a type.
 */
export type Options = {
  typeCastingStrategy?: 'tryCasting' | 'expectExactTypes'
  errorReportingStrategy?: 'allErrors' | 'stopAtFirstError'
  // TODO: object strictness?
}

/**
 * The default recommended options to be used in the decoding process.
 */
export const defaultOptions: Options = {
  typeCastingStrategy: 'expectExactTypes',
  errorReportingStrategy: 'stopAtFirstError',
}

/**
 * The result of the process of decoding: it can either hold a value or an array of decoding errors.
 */
export type Result<A> = result.Result<A, decoding.Error[]>

/**
 * TODO: add doc
 */
export type Error = path.WithPath<{
  expected: string
  got: unknown
}>

/**
 * Utility function to add a new expected type to the `expected` field of a `decoding.Error`.
 */
export function addExpected(otherExpected: string): (error: decoding.Error) => decoding.Error {
  return (error: decoding.Error) => ({
    ...error,
    expected: `${error.expected} or ${otherExpected}`,
  })
}

/**
 * @param value the value the decoding result will return
 * @returns a `decoding.Result` that succeeds with the given value
 */
export const succeed = <A>(value: A): decoding.Result<A> => result.ok(value)

/**
 * @param errors the errors that made the decoding process fail
 * @returns a `decoding.Result` that fails with the given array of errors
 */
export const failWithErrors = <A>(errors: decoding.Error[]): decoding.Result<A> => result.fail(errors)

/**
 * @param expected the expected value
 * @param got the actual value that couldn't be decoded
 * @returns a `decoding.Result` that fails with a single error with an empty path and the provided
 *          `expected` and `got` values
 */
export const fail = <A>(expected: string, got: unknown): decoding.Result<A> =>
  decoding.failWithErrors([{ expected, got, path: path.empty() }])
