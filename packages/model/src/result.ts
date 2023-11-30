/**
 * Represents the result of a computation that can either {@link ok succeed} with a value of type `A`
 * or {@link fail} with an error of type `E`
 */
export type Result<A, E> = Ok<A> | Failure<E>

/**
 * @param value the value to wrap in an {@link Ok} result
 * @returns a {@link Result} that always succeeds with the given value
 */
export function ok<const A>(value: A): Ok<A> {
  return new Ok(value)
}

/**
 * @param error the error to wrap in a {@link Failure} result
 * @returns a {@link Result} that always fails with the given error
 */
export function fail<const E>(error: E): Failure<E> {
  return new Failure(error)
}

/**
 * A successful {@link Result}. It represents the result of a computation that succeeded with a value of type `A`
 */
export class Ok<A> {
  /**
   * The result value
   */
  readonly value: A
  /**
   * {@link Result} discriminant to tell wether a result is successful or not. Always true
   */
  readonly isOk: true = true
  /**
   * {@link Result} discriminant to tell wether a result is successful or not. Always false
   */
  readonly isFailure: false = false
  constructor(value: A) {
    this.value = value
  }

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
  chain = <const B, const E1>(f: (value: A) => Result<B, E1>): Result<B, E1> => f(this.value)
  /**
   * @param value the new value to replace an {@link Ok}'s value
   * @returns this if this is a {@link Failure}; if this is an {@link Ok} result, returns a new
   *          succeeding result with the provided value
   * @example ```ts
   *          result.ok(1).replace(2) // -> result.ok(2)
   *          result.fail("error").replace(2) // -> result.fail("error")
   *          ```
   */
  replace = <const B>(value: B): Ok<B> => ok(value)
  /**
   * @param f the function to apply to the result's held value
   * @returns this if this is a {@link Failure} result; if this is an {@link Ok} result, returns a new
   *          succeeding result with `f` applied to its value
   * @example ```ts
   *          result.ok(1).map((n) => n + 1) // -> result.ok(2)
   *          result.fail("error").map((n) => n + 1) // -> result.fail("error")
   *          ```
   */
  map = <const B>(f: (value: A) => B): Ok<B> => ok(f(this.value))
  mapError = (): Ok<A> => ok(this.value)
  recover = (): A => this.value
  or = (): Ok<A> => this
  lazyOr = (): Ok<A> => this
  /**
   * @param onOk a function called when this result is {@link Ok}, passing it the result's held value
   * @returns the result of applying one of the two provided functions to this value or error
   * @example ```ts
   *          result.ok(1).match(
   *            (n) => n + 1,
   *            (error) => `scary ${error}`,
   *          )
   *          // -> 2
   *          ```
   */
  match = <B, C>(onOk: (value: A) => B, _onFailure: (error: never) => C): B => onOk(this.value)
}

/**
 * A failing {@link Result}. It represents the result of a computation that failed with an error of type `E`
 */
export class Failure<E> {
  /**
   * The error value
   */
  readonly error: E
  /**
   *  {@link Result} discriminant to tell wether a result is successful or not. Always false
   */
  readonly isOk: false = false
  /**
   *  {@link Result} discriminant to tell wether a result is successful or not. Always true
   */
  readonly isFailure: true = true
  constructor(error: E) {
    this.error = error
  }
  chain = (): Failure<E> => this
  replace = (): Failure<E> => this
  map = (): Failure<E> => this
  /**
   * @param f the function to apply to the result's error
   * @returns this if this is an {@link Ok} result; if this is a {@link Failure}, returns a new
   *          failing result with `f` applied to its error
   * @example ```ts
   *          result.error("error").mapError((error) => `scary ${error}`) // -> result.fail("scary error")
   *          result.ok(1).mapError((error) => `scary ${error}`) // -> result.ok(1)
   *          ```
   */
  mapError = <const E1>(f: (error: E) => E1): Failure<E1> => fail(f(this.error))
  /**
   * @param fromError a function used to generate a value `A` from an error `E`
   * @returns the value held by this result if it is `Ok`, or the result of applying `fromError` to
   *          its error if it is a `Failure`
   * @example ```ts
   *          result.ok(1).recover((_) => 2) // -> 1
   *          result.fail("error").recover((_) => 2) // -> 2
   *          ```
   */
  recover = <A>(fromError: (error: E) => A): A => fromError(this.error)
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
  or = <A, E1>(other: Result<A, E1>): Result<A, E1> => other
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
  lazyOr = <A, E1>(other: (error: E) => Result<A, E1>): Result<A, E1> => other(this.error)
  /**
   * @param onFailure a function called when this result is a {@link Failure}, passing it the result's error value
   * @returns the result of applying one of the two provided functions to this value or error
   * @example ```ts
   *          result.fail("error").match(
   *            (n) => n + 1,
   *            (error) => `scary ${error}`,
   *          )
   *          // -> "scary error"
   *          ```
   */
  match = <B, C>(_onOk: (value: never) => B, onFailure: (error: E) => C): C => onFailure(this.error)
}
