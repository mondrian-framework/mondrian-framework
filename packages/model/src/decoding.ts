import { decoding, result, path } from './index'
import { WithPath } from './utils'

/**
 * The options that can be used when decoding a type:
 * - `typeCastingStrategy` its possible values are:
 *   - `"expectExactTypes"` (default): no casts will be attempted in the decoding process
 *   - `"tryCasting"`: type casting may be attempted in the decoding process
 * - `errorReportingStrategy`: its possible values are:
 *   - `"stopAtFirstError"` (default): the decoding process will stop and fail at the first error it encounters
 *   - `"allErrors"`: the decoding process will try and gather as much errors as possible before failing
 * - `fieldStrictness`: its possible values are:
 *   - `"expectExactFields"` (default): when decoding objects or entities it will return an error if additional fields are present
 *   - `"allowAdditionalFields"`:  when decoding objects or entities it will ignore additional fields if present
 */
export type Options = {
  typeCastingStrategy?: 'tryCasting' | 'expectExactTypes'
  errorReportingStrategy?: 'allErrors' | 'stopAtFirstError'
  fieldStrictness?: 'allowAdditionalFields' | 'expectExactFields'
}

/**
 * The default recommended options to be used in the decoding process.
 */
export const defaultOptions: Options = {
  typeCastingStrategy: 'expectExactTypes',
  errorReportingStrategy: 'stopAtFirstError',
}

/**
 * The result of the process of decoding: it can either hold a value `A` or an array of
 * {@link Error decoding errors}
 */
export type Result<A> = result.Result<A, decoding.Error[]>

/**
 * An error that may take place in the decoding process:
 *   - `expected`: describes the expected type
 *   - `got`: is the value that broke the expectation
 *   - `path`: is the path where the failure took place
 *
 * @example Consider the following error:
 *          ```ts
 *          { expected: "string", got: 1, path: "$[1].foo" }
 *          ```
 *          Let's see step by step what this means:
 *          - `expected: "string"` the decoder expected to find a string value
 *          - `got: 1` but it got a value `1`, which is not a string
 *          - `path: "$[1].foo"` the error took place while decoding a field called `foo`
 *            in an object at index 1 of an array
 */
export type Error = WithPath<{
  expected: string
  got: unknown
}>

/**
 * @param otherExpected the string to add to the `expected` field of an error
 * @returns a function that can enrich a {@link Error decoding error} by adding another expected
 *          value to its `expected` field. The value is not mutated in place but a new updated
 *          value is returned
 * @example ```ts
 *          const error = { expected: "foo", got: 1, path: path.empty() }
 *          const newError = addExpected("bar")(error)
 *          // newError -> { expected: "foo or bar", got: 1, path: path.empty() }
 *          ```
 */
export function addExpected(otherExpected: string): (error: decoding.Error) => decoding.Error {
  return (error: decoding.Error) => ({
    ...error,
    expected: `${error.expected} or ${otherExpected}`,
  })
}

/**
 * @param value the value held by the {@link Result decoding result}
 * @returns a `Result` that succeeds with the given value
 * @example consider this custom decoding function:
 *          ```ts
 *          function constant(_value: unknown): decoding.Result<null> {
 *            return decoding.succeed(null)
 *          }
 *          ```
 *          This is a decoder that ignores the given value and always succeeds returning a `null` value.
 */
export const succeed = <A>(value: A): decoding.Result<A> => result.ok(value)

/**
 * @param errors the errors that made the decoding process fail
 * @returns a {@link Result `Result`} that fails with the given array of errors.
 *          Most of the times, unless you explicitly need to fail with multiple errors,
 *          {@link fail `fail`} is the function that will best suit your needs
 * @example this function can be useful when implementing decoders for custom types.
 *          Consider this custom decoding function:
 *          ```ts
 *          function alwaysFail(_value: unknown): decoding.Result<null> {
 *            const errors = [
 *              { expected: "foo", got: null, path: path.empty() },
 *              { expected: "bar", got: null, path: path.empty() },
 *            ]
 *            return decoding.failWithErrors(errors)
 *          }
 *          ```
 *          This decoder always fails with a default list of errors
 */
export const failWithErrors = <A>(errors: decoding.Error[]): decoding.Result<A> => result.fail(errors)

/**
 * @param expected the expected value
 * @param got the actual value that couldn't be decoded
 * @returns a {@link Result `Result`} that fails with a single error with an empty path and the provided
 *          `expected` and `got` values
 * @example this function can be handy when implementing decoders for custom types. Consider this
 *          decoder function that decodes even numbers:
 *          ```ts
 *          function decodeEven(value: unknown): decoding.Result<number> {
 *            if (typeof value === "number") {
 *              return value % 2 === 0 ? decoding.succeed(value) : decoding.fail("an even number", value)
 *            } else {
 *              return decoding.fail("a number")
 *            }
 *          }
 *          decodeEven("foo") // -> [{ expected: "a number", got: "foo", path: path.empty() }]
 *          decodeEven(1) // -> [{ expected: "an even number", got: 1, path: path.empty() }]
 *          ```
 *          The function `decodeEven` will fail with the provided message when the value it tries
 *          to decode is not an even number. As you may notice, it can be useful to define custom and
 *          informative error messages to signal the reason behind the failure of a decoder
 */
export const fail = <A>(expected: string, got: unknown): decoding.Result<A> =>
  decoding.failWithErrors([{ expected, got, path: path.empty() }])

/**
 * @param error the {@link Error error} to turn into a string
 * @returns a string representation of the given error
 */
export function errorToString(error: Error): string {
  const { expected, got, path } = error
  return `expected: ${expected}, got: ${got}, path: ${path.format()}`
}
