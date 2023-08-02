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

/*
export type Error = { path?: string; error: string; value: unknown; unionElement?: string }

export type Success<T> = {
  success: true
  value: T
}

export type Failure = {
  success: false
  errors: Error[]
}

export type Result<T> = Success<T> | Failure

export function success<T>(value: T): { success: true; value: T } {
  return { success: true, value }
}

export function error(error: string, value: unknown): Failure {
  return errors([{ error, value }])
}

export function errors(errors: Error[]): Failure {
  return { success: false, errors }
}

export function richError(error: string, value: unknown, prefixes: string | number): Error {
  return { error, value, path: buildPath([prefixes]) }
}

export function enrichErrors<T>(result: Result<T>, prefixes?: (string | number)[]): Result<T> {
  if (!result.success) {
    if (prefixes == null || prefixes.length === 0) {
      return result
    }
    return errors(
      result.errors.map((e) => {
        const oldElements = e.path != null ? unbuildPath(e.path) : []
        const elements = [...prefixes, ...oldElements]
        return {
          ...e,
          path: buildPath(elements),
        }
      }),
    )
  }
  return result
}

function buildPath(root: (string | number)[]): string {
  let s = ''
  for (const v of root) {
    if (typeof v === 'number') {
      s = `${s}[${v}]`
    }
    if (typeof v === 'string') {
      s = `${s}.${v}`
    }
  }
  return s
}
function unbuildPath(root: string): (string | number)[] {
  if (root === '') {
    return []
  }
  const e: (string | number)[] = []
  let start = 0
  for (let i = 0; i < root.length; i++) {
    if (root[i] === '.' || root[i] === '[') {
      if (start !== 0) {
        const ss = root.substring(start, i)
        e.push(ss)
      }
      start = i + 1
    }
    if (root[i] === ']') {
      const ss = root.substring(start, i)
      e.push(Number(ss))
      start = 0
    }
  }
  const ss = root.substring(start, root.length)
  e.push(ss)
  return e
}

export function concat2<V1, V2>(v1: Result<V1>, f1: (v: V1) => Result<V2>): Result<V2> {
  if (!v1.success) {
    return v1
  }
  const v2 = f1(v1.value)
  return v2
}

export function firstOf2<V>(f1: () => Result<V>, f2: () => Result<V>): Result<V> {
  const v1 = f1()
  if (!v1.success) {
    const v2 = f2()
    if (v2.success) {
      return v2
    }
  }
  return v1
}
*/
