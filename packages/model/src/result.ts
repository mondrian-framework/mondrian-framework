export type Error = { path?: string; error: string; value: unknown; unionElement?: string }

export type Success<T> = { success: true; value: T }

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
