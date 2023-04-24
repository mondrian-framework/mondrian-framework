import { LazyType, Type } from './type-system'

export type JSONType = string | number | boolean | null | undefined | { [K in string]: JSONType } | JSONType[]

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never


export function lazyToType(t: LazyType): Type {
  if (typeof t === 'function') {
    return t()
  }
  return t
}

export function assertNever(t: never): never {
  throw new Error(`Unreachable`)
}
