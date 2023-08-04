/**
 * TODO: add Doc to whole module
 */
export type Result<A, E> = {
  chain<B>(f: (value: A) => Result<B, E>): Result<B, E>
  replace<B>(value: B): Result<B, E>
  map<B>(f: (value: A) => B): Result<B, E>
  mapError<E1>(f: (error: E) => E1): Result<A, E1>
  recover(fromError: (error: E) => A): A
  or(other: Result<A, E>): Result<A, E>
  lazyOr(other: (error: E) => Result<A, E>): Result<A, E>
  match<B>(onOk: (value: A) => B, onFailure: (error: E) => B): B
} & ({ readonly isOk: true; readonly value: A } | { readonly isOk: false; readonly error: E })

class Ok<A, E> {
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

class Failure<A, E> {
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

export function ok<A, E>(value: A): Ok<A, E> {
  return new Ok(value)
}

export function fail<A, E>(error: E): Failure<A, E> {
  return new Failure(error)
}
