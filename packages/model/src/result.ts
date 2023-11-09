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

//TODO: add doc

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
  constructor(value: A) {
    this.value = value
  }

  chain = <const B, const E1>(f: (value: A) => Result<B, E1>): Result<B, E1> => f(this.value)
  replace = <const B>(value: B): Ok<B> => ok(value)
  /**
   * If {@link Ok} returns another {@link Ok} with the mapped value
   */
  map = <const B>(f: (value: A) => B): Ok<B> => ok(f(this.value))
  mapError = (): Ok<A> => ok(this.value)
  recover = (): A => this.value
  or = (): Ok<A> => this
  lazyOr = (): Ok<A> => this
  match = <B, C>(onOk: (value: A) => B, _onFailure: (error: never) => C): B => onOk(this.value)
}

/**
 * A failing {@link Result}. It represents the result of a computation that failed with an error of type `E`
 */
export class Failure<E> {
  readonly error: E
  /**
   *  {@link Result} discriminant to tell wether a result is successful or not. Always false
   */
  readonly isOk: false = false
  /**
   * The error value
   */
  constructor(error: E) {
    this.error = error
  }

  chain = (): Failure<E> => this
  replace = (): Failure<E> => this
  /**
   * If {@link Failure} returns the same {@link Failure}
   */
  map = (): Failure<E> => this
  mapError = <const E1>(f: (error: E) => E1): Failure<E1> => fail(f(this.error))
  recover = <A>(fromError: (error: E) => A): A => fromError(this.error)
  or = <A, E1>(other: Result<A, E1>): Result<A, E1> => other
  lazyOr = <A, E1>(other: (error: E) => Result<A, E1>): Result<A, E1> => other(this.error)
  match = <B, C>(_onOk: (value: never) => B, onFailure: (error: E) => C): C => onFailure(this.error)
}
