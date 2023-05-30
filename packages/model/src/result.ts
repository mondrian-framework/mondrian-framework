export type Success<T> = { success: true; value: T }
export type Failure = { success: false; errors: { path?: string; error: string; value: unknown }[] }
export type Result<T> = Success<T> | Failure

export function success<T>(value: T): { success: true; value: T } {
  return { success: true, value }
}

export function error(error: string, value: unknown): Failure {
  return errors([{ error, value }])
}

export function errors(errors: { path?: string; error: string; value: unknown }[]): Failure {
  return { success: false, errors }
}

export function enrichErrors<T>(result: Result<T>, key: string): Result<T> {
  if (!result.success) {
    return errors(result.errors.map((e) => ({ ...e, path: e.path != null ? `${key}/${e.path}` : `${key}/` })))
  }
  return result
}

export function concat2<V1, V2>(v1: Result<V1>, f1: (v: V1) => Result<V2>): Result<V2> {
  if (!v1.success) {
    return v1
  }
  const v2 = f1(v1.value)
  return v2
}
