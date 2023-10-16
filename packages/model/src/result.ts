/**
 * Represents the result of a computation that can either {@link ok succeed} with a value of type `A`
 * or {@link fail} with an error of type `E`
 */
export type Result<A, E> = Ok<A, E> | Failure<A, E>

/**
 * A successful {@link Result}. It represents the result of a computation that succeeded with a value of type `A`
 */
export type Ok<A, E> = {
  /**
   * {@link Result} discriminant to tell wether a result is successful or not. Always true
   */
  readonly isOk: true

  /**
   * The result value
   */
  readonly value: A
} & ResultUtility<A, E>

/**
 * A failing {@link Result}. It represents the result of a computation that failed with an error of type `E`
 */
export type Failure<A, E> = {
  /**
   *  {@link Result} discriminant to tell wether a result is successful or not. Always false
   */
  readonly isOk: false

  /**
   * The error value
   */
  readonly error: E
} & ResultUtility<A, E>

/**
 * @param value the value to wrap in an {@link Ok} result
 * @returns a {@link Result} that always succeeds with the given value
 */
export function ok<A, E>(value: A): Ok<A, E> {
  return new OkImpl(value)
}

/**
 * @param error the error to wrap in a {@link Failure} result
 * @returns a {@link Result} that always fails with the given error
 */
export function fail<A, E>(error: E): Failure<A, E> {
  return new FailureImpl(error)
}

type ResultUtility<A, E> = {
  /**
   * @param f a continuation function to update the value held by an `Ok` result
   * @returns this if this is a {@link Failure}; if this is an {@link Ok}, returns the
   *          result of applying the given function `f` to its value
   * @example ```ts
   *          ok(1).chain((n) => ok(n + 1)) // -> ok(2)
   *          ok(1).chain((n) => error("fail")) // -> error("fail")
   *          error("fail").chain((n) => ok(n + 1)) // -> error("fail")
   *          error("fail").chain((n) => error("fail again")) // -> error("fail")
   *          ```
   */
  chain<B, E1 = E>(f: (value: A) => Result<B, E1>): Result<B, E | E1>

  /**
   * @param value the new value to replace an {@link Ok}'s value
   * @returns this if this is a {@link Failure}; if this is an {@link Ok} result, returns a new
   *          succeeding result with the provided value
   * @example ```ts
   *          result.ok(1).replace(2) // -> result.ok(2)
   *          result.fail("error").replace(2) // -> result.fail("error")
   *          ```
   */
  replace<B>(value: B): Result<B, E>

  /**
   * @param f the function to apply to the result's held value
   * @returns this if this is a {@link Failure} result; if this is an {@link Ok} result, returns a new
   *          succeeding result with `f` applied to its value
   * @example ```ts
   *          result.ok(1).map((n) => n + 1) // -> result.ok(2)
   *          result.fail("error").map((n) => n + 1) // -> result.fail("error")
   *          ```
   */
  map<B>(f: (value: A) => B): Result<B, E>

  /**
   * @param f the function to apply to the result's error
   * @returns this if this is an {@link Ok} result; if this is a {@link Failure}, returns a new
   *          failing result with `f` applied to its error
   * @example ```ts
   *          result.error("error").mapError((error) => `scary ${error}`) // -> result.fail("scary error")
   *          result.ok(1).mapError((error) => `scary ${error}`) // -> result.ok(1)
   *          ```
   */
  mapError<E1>(f: (error: E) => E1): Result<A, E1>

  /**
   * @param fromError a function used to generate a value `A` from an error `E`
   * @returns the value held by this result if it is `Ok`, or the result of applying `fromError` to
   *          its error if it is a `Failure`
   * @example ```ts
   *          result.ok(1).recover((_) => 2) // -> 1
   *          result.fail("error").recover((_) => 2) // -> 2
   *          ```
   */
  recover(fromError: (error: E) => A): A

  /**
   * @param other the other {@link Result}. Note that this parameter it is eagerly evaluated:
   *        if computing the `other` result is an expensive task and should be performed only if
   *        necessary, consider using the {@link Result.lazyOr} method
   * @returns this if it is an {@link Ok} result, otherwise returns the other result
   * @example ```ts
   *          result.ok(1).or(result.fail("error")) // -> result.ok(1)
   *          result.ok(1).or(result.ok(2)) // -> result.ok(1)
   *          result.fail("error").or(result.ok(1)) // -> result.ok(1)
   *          result.fail("error").or(result.fail("error2")) // -> result.fail("error2")
   *          ```
   */
  or(other: Result<A, E>): Result<A, E>

  /**
   * The same as {@link Result.or} but the second result is lazy. This can be useful if computing
   * the second result might be an expensive task and should be performed only if necessary!
   *
   * @param other the other {@link Result} getter
   * @returns this if is an {@link Ok} result, otherwise the other result
   * @example ```ts
   *          result.ok(1).lazyOr(() => task()) // -> result.ok(1)
   *          result.fail("error").lazyOr(() => task()) // -> task()
   *          ```
   *          Note that in the first example `task` is never executed! This behaviour resembles the
   *          short-circuiting behaviour of logical operators like `||` and `&&`
   */
  lazyOr(other: () => Result<A, E>): Result<A, E>

  /**
   * @param onOk a function called when this result is {@link Ok}, passing it the result's held value
   * @param onFailure a function called when this result is a {@link Failure}, passing it the result's error value
   * @returns the result of applying one of the two provided functions to this value or error
   * @example ```ts
   *          result.ok(1).match(
   *            (n) => n + 1,
   *            (error) => `scary ${error}`,
   *          )
   *          // -> 2
   *
   *          result.fail("error").match(
   *            (n) => n + 1,
   *            (error) => `scary ${error}`,
   *          )
   *          // -> "scary error"
   *          ```
   */
  match<B>(onOk: (value: A) => B, onFailure: (error: E) => B): B
}

class OkImpl<A, E> implements Ok<A, E> {
  readonly value: A
  readonly isOk: true = true
  constructor(value: A) {
    this.value = value
  }

  chain = <B, E1>(f: (value: A) => Result<B, E1>): Result<B, E | E1> => f(this.value)
  replace = <B>(value: B): Result<B, E> => ok(value)
  map = <B>(f: (value: A) => B): Result<B, E> => ok(f(this.value))
  mapError = <E1>(_f: (error: E) => E1): Result<A, E1> => ok(this.value)
  recover = (_fromError: (error: E) => A): A => this.value
  or = (_other: Result<A, E>): Result<A, E> => this
  lazyOr = (_other: (error: E) => Result<A, E>): Result<A, E> => this
  match = <B>(onOk: (value: A) => B, _onFailure: (error: E) => B): B => onOk(this.value)
}

class FailureImpl<A, E> implements Failure<A, E> {
  readonly error: E
  readonly isOk: false = false
  constructor(error: E) {
    this.error = error
  }

  chain = <B, E1>(_f: (value: A) => Result<B, E1>): Result<B, E | E1> => fail(this.error)
  replace = <B>(_value: B): Result<B, E> => fail(this.error)
  map = <B>(_f: (value: A) => B): Result<B, E> => fail(this.error)
  mapError = <E1>(f: (error: E) => E1): Result<A, E1> => fail(f(this.error))
  recover = (fromError: (error: E) => A): A => fromError(this.error)
  or = (other: Result<A, E>): Result<A, E> => other
  lazyOr = (other: (error: E) => Result<A, E>): Result<A, E> => other(this.error)
  match = <B>(_onOk: (value: A) => B, onFailure: (error: E) => B): B => onFailure(this.error)
}

/**
 * @param values an array of values to loop over
 * @param initialValue the initial accumulator used to accumulate successful results
 * @param combineValues a function used to combine a new successful result with the accumulator
 * @param initialError the initial accumulator used to accumulate failing results
 * @param combineErrors a function used to combine a new failing result with the accumulator
 * @param action the function used to map each value into a result to be accumulated
 * @returns an {@link Ok} result if applying `action` to all the item in `values` results in a successful result,
 *          a {@link Failure} otherwise.
 *
 *          The value held by the `Ok` result is obtained by combining all the values held by the successful results
 *          using `combineValues`.
 *          The error held by the `Failure` result is obtained by combining all the encountered errors using
 *          `combineErrors`
 *
 *          Note that all the values are iterated over and `action` is applied to each one before returning; if
 *          you need to fail as soon as an error is encountered, {@link tryEachFailFast} would best suit your needs
 * @example ```ts
 *          const sum = (n, m) => n + m
 *          const concat = (xs, x) => [...xs, x]
 *          const isEven = (n) => n % 2 === 0 ? result.ok(n) : result.fail(`${n} is not even!`)
 *          tryEach([2, 4, 6], 0, sum, "", [], concat, isEven) // -> result.ok(12)
 *          tryEach([2, 3, 5], 0, sum, "", [], concat, isEven) // -> result.fail(["3 is not even!", "5 is not even!"])
 *          ```
 */
export function tryEach<A, R, R1, E, E1>(
  values: readonly A[],
  initialValue: R1,
  combineValues: (previous: R1, current: R) => R1,
  initialError: E1,
  combineErrors: (previous: E1, current: E) => E1,
  action: (currentValue: A, index: number) => Result<R, E>,
): Result<R1, E1> {
  let valuesAccumulator = initialValue
  let errorsAccumulator = initialError
  let encounteredError = false
  for (let index = 0; index < values.length; index++) {
    const result = action(values[index], index)
    if (result.isOk) {
      if (encounteredError) {
        continue
      } else {
        valuesAccumulator = combineValues(valuesAccumulator, result.value)
      }
    } else {
      encounteredError = true
      errorsAccumulator = combineErrors(errorsAccumulator, result.error)
    }
  }
  return encounteredError ? fail(errorsAccumulator) : ok(valuesAccumulator)
}

/**
 * This is the same as {@link tryEach} but fails as soon as the first error is encountered.
 * If you need to accumulate all the error then {@link tryEach} would best suit your needs.
 *
 * @param values an array of values to loop over
 * @param initialValue the initial accumulator used to accumulate successful results
 * @param combineValues a function used to combine a new successful result with the accumulator
 * @param action the function used to map each value into a result to be accumulated
 * @returns an {@link Ok} result if applying `action` to all the item in `values` results in a successful result,
 *          a {@link Failure} otherwise.
 *
 *          The value held by the `Ok` result is obtained by combining all the values held by the successful results
 *          using `combineValues`.
 *          The error held by the `Failure` result is the first error returned by applying `action`
 * @example ```ts
 *          const sum = (n, m) => n + m
 *          const isEven = (n) => n % 2 === 0 ? result.ok(n) : result.fail(`${n} is not even!`)
 *          tryEachFailFast([2, 4, 6], 0, sum, "", isEven) // -> result.ok(12)
 *          tryEachFailFast([2, 3, 5], 0, sum, "", isEven) // -> result.fail("3 is not even!")
 *          ```
 */
export function tryEachFailFast<A, R, R1, E>(
  values: readonly A[],
  initialValue: R1,
  combineValues: (previous: R1, current: R) => R1,
  action: (currentValue: A, index: number) => Result<R, E>,
): Result<R1, E> {
  let valuesAccumulator = initialValue
  for (let index = 0; index < values.length; index++) {
    const result = action(values[index], index)
    if (result.isOk) {
      valuesAccumulator = combineValues(valuesAccumulator, result.value)
    } else {
      return fail(result.error)
    }
  }
  return ok(valuesAccumulator)
}

/**
 * @param value the value you want to check if is a result or not
 * @returns Returns true if the given unknown value is actually a result
 */
export function isResult(value: unknown): value is Result<unknown, unknown> {
  return value instanceof OkImpl || value instanceof FailureImpl
}

export function isOkResult(value: unknown): value is Ok<unknown, unknown> {
  return isResult(value) && value.isOk
}

export function isFailureResult(value: unknown): value is Failure<unknown, unknown> {
  return isResult(value) && !value.isOk
}
