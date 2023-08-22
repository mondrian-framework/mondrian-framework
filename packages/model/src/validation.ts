import { result, validation, path } from './index'

export type Options = {
  errorReportingStrategy: 'allErrors' | 'stopAtFirstError'
}

export const defaultOptions: validation.Options = {
  errorReportingStrategy: 'stopAtFirstError',
}

/**
 * The result of the validation process, it could either be `true` in case of success or
 * a list of `validator.Error` in case of failure.
 */
export type Result = result.Result<true, validation.Error[]>

/**
 * TODO: add doc
 */
export type Error = path.WithPath<{
  assertion: string
  got: unknown
}>

/**
 * The value returned by a succeeding validation process.
 */
export const succeed: () => validation.Result = () => result.ok(true)

/**
 * @param errors the errors that made the validation process fail
 * @returns a `validator.Result` that fails with the given array of errors
 */
export const failWithErrors = (errors: validation.Error[]): validation.Result => result.fail(errors)

/**
 * @param assertion the assertion that failed
 * @param got the actual value that couldn't be validated
 * @returns a `validator.Result` that fails with a single error with an empty path and the provided
 *          `assertion` and `got` values
 */
export const fail = (assertion: string, got: unknown): validation.Result =>
  validation.failWithErrors([{ assertion, got, path: path.empty() }])
