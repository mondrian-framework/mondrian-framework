/**
 * Either an {@link Ok} or a {@link Failure}
 */
export type Result<A, E> = Ok<A, E> | Failure<A, E>

/**
 * A succesfull result.
 */
export type Ok<A, E> = {
  /**
   * {@link Result} discriminant. Always true.
   */
  readonly isOk: true
  /**
   * the result value.
   */
  readonly value: A
} & ResultUtility<A, E>

/**
 * A failure result.
 */
export type Failure<A, E> = {
  /**
   *  {@link Result} discriminant. Always false.
   */
  readonly isOk: false
  /**
   * the error value.
   */
  readonly error: E
} & ResultUtility<A, E>

/**
 * Creates an {@link Ok} result.
 * @param value the result value.
 * @returns the {@link Ok} result.
 */
export function ok<A, E>(value: A): Ok<A, E> {
  return new OkImpl(value)
}

/**
 * Creates a {@link Failure} result.
 * @param error the error value.
 * @returns the {@link Failure} result.
 */
export function fail<A, E>(error: E): Failure<A, E> {
  return new FailureImpl(error)
}

type ResultUtility<A, E> = {
  /**
   * Chains a new {@link Result} in case of {@link Ok} otherwise returns the actual {@link Failure}.
   * @param f the mapper function.
   * @returns the chained {@link Result}.
   */
  chain<B>(f: (value: A) => Result<B, E>): Result<B, E>
  /**
   * Replaces the {@link Ok} value otherwise returns the actual {@link Failure}.
   * @param value the new value.
   * @returns the replaced {@link Result}.
   */
  replace<B>(value: B): Result<B, E>
  /**
   * Maps the result value if is {@link Ok} otherwise returns the actual {@link Failure}.
   * @param f the mapper function.
   * @returns the mapped {@link Result}.
   */
  map<B>(f: (value: A) => B): Result<B, E>
  /**
   * Maps the error value if is {@link Failure} otherwise returns the actual {@link Ok}.
   * @param f the mapper function.
   * @returns the mapped {@link Result}.
   */
  mapError<E1>(f: (error: E) => E1): Result<A, E1>
  /**
   * Returns the {@link Ok} value otherwise call the recover function and returns it's result.
   * @param fromError the recover function.
   * @returns the {@link Ok} value or the receovered value.
   */
  recover(fromError: (error: E) => A): A
  /**
   * Returns this if is {@link Ok} otherwise the other result.
   * @param other the other {@link Result}.
   * @returns this if is {@link Ok} otherwise other other result.
   */
  or(other: Result<A, E>): Result<A, E>
  /**
   * Returns this if is {@link Ok} otherwise the other result.
   * @param other the other {@link Result} getter.
   * @returns this if is {@link Ok} otherwise other other result.
   */
  lazyOr(other: (error: E) => Result<A, E>): Result<A, E>
  /**
   * Match this {@link Result}.
   * @param onOk called when is {@link Ok} passing the resutl value.
   * @param onFailure called when is {@link Failure} passing the error value.
   * @returns the match return value.
   */
  match<B>(onOk: (value: A) => B, onFailure: (error: E) => B): B
}

class OkImpl<A, E> implements Ok<A, E> {
  readonly value: A
  readonly isOk: true = true
  constructor(value: A) {
    this.value = value
  }

  chain = <B>(f: (value: A) => Result<B, E>): Result<B, E> => f(this.value)
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

  chain = <B>(_f: (value: A) => Result<B, E>): Result<B, E> => fail(this.error)
  replace = <B>(_value: B): Result<B, E> => fail(this.error)
  map = <B>(_f: (value: A) => B): Result<B, E> => fail(this.error)
  mapError = <E1>(f: (error: E) => E1): Result<A, E1> => fail(f(this.error))
  recover = (fromError: (error: E) => A): A => fromError(this.error)
  or = (other: Result<A, E>): Result<A, E> => other
  lazyOr = (other: (error: E) => Result<A, E>): Result<A, E> => other(this.error)
  match = <B>(_onOk: (value: A) => B, onFailure: (error: E) => B): B => onFailure(this.error)
}
