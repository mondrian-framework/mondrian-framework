export interface Result<A, E> {
  then<B>(f: (value: A) => Result<B, E>): Result<B, E>
  replace<B>(value: B): Result<B, E>
  map<B>(f: (value: A) => B): Result<B, E>
  mapError<E1>(f: (error: E) => E1): Result<A, E1>
  unwrap(fallback: A): A
  lazyUnwrap(fallback: () => A): A
  or(other: Result<A, E>): Result<A, E>
  lazyOr(other: () => Result<A, E>): Result<A, E>
  match<B>(onOk: (value: A) => B, onFailure: (error: E) => B): B
}

class Ok<A, E> implements Result<A, E> {
  private value: A
  constructor(value: A) {
    this.value = value
  }

  then = <B>(f: (value: A) => Result<B, E>): Result<B, E> => f(this.value)
  replace = <B>(value: B): Result<B, E> => ok(value)
  map = <B>(f: (value: A) => B): Result<B, E> => ok(f(this.value))
  mapError = <E1>(_f: (error: E) => E1): Result<A, E1> => ok(this.value)
  unwrap = (_fallback: A): A => this.value
  lazyUnwrap = (_fallback: () => A): A => this.value
  or = (_other: Result<A, E>): Result<A, E> => this
  lazyOr = (_other: () => Result<A, E>): Result<A, E> => this
  match = <B>(onOk: (value: A) => B, _onFailure: (error: E) => B): B => onOk(this.value)
}

class Failure<A, E> implements Result<A, E> {
  private error: E
  constructor(error: E) {
    this.error = error
  }

  then = <B>(_f: (value: A) => Result<B, E>): Result<B, E> => fail(this.error)
  replace = <B>(_value: B): Result<B, E> => fail(this.error)
  map = <B>(_f: (value: A) => B): Result<B, E> => fail(this.error)
  mapError = <E1>(f: (error: E) => E1): Result<A, E1> => fail(f(this.error))
  unwrap = (fallback: A): A => fallback
  lazyUnwrap = (fallback: () => A): A => fallback()
  or = (other: Result<A, E>): Result<A, E> => other
  lazyOr = (other: () => Result<A, E>): Result<A, E> => other()
  match = <B>(_onOk: (value: A) => B, onFailure: (error: E) => B): B => onFailure(this.error)
}

export function ok<A, E>(value: A): Result<A, E> {
  return new Ok(value)
}

export function fail<A, E>(error: E): Result<A, E> {
  return new Failure(error)
}
