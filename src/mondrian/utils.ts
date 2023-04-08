import { LazyType, Type } from './type-system'

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

export type PartialDeep<T> = T extends Date
  ? Date | undefined
  : T extends object
  ? {
      [K in keyof T]?: PartialDeep<T[K]>
    }
  : T

export function lazyToType(t: LazyType): Type {
  if (typeof t === 'function') {
    return t()
  }
  return t
}
