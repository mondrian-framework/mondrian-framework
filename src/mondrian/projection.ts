import { LazyType, boolean, object, optional, union } from './type-system'
import { assertNever, lazyToType } from './utils'

export type Projection<T> = T extends Date
  ? true | undefined
  : T extends (infer E)[]
  ? Projection<E>
  : T extends object
  ?
      | {
          [K in keyof T]?: Projection<T[K]> | true
        }
      | true
  : true | undefined

export type GenericProjection = true | { [K in string]?: true | GenericProjection }

export function getProjectionType(type: LazyType): LazyType {
  if (typeof type === 'function') {
    return () => {
      const t = getProjectionType(type())
      const t2 = lazyToType(t)
      return t2
    }
  }
  if (
    type.kind === 'boolean' ||
    type.kind === 'string' ||
    type.kind === 'number' ||
    type.kind === 'null' ||
    type.kind === 'enumerator' ||
    type.kind === 'custom'
  ) {
    return boolean()
  }
  if (type.kind === 'object') {
    return union({
      first: boolean(),
      second: object(
        Object.fromEntries(
          Object.entries(type.type).map(([k, v]) => {
            const t = getProjectionType(v)
            return [k, optional(t)]
          }),
        ),
        { strict: true }
      ),
    })
  }
  if (type.kind === 'array-decorator' || type.kind === 'optional-decorator' || type.kind === 'default-decorator') {
    return getProjectionType(type.type)
  }
  if (type.kind === 'union-operator') {
    const subProjection = Object.entries(type.types).flatMap(([k, t]) => {
      if (lazyToType(t).kind !== 'object') {
        return []
      }
      return [[k, getProjectionType(t)]] as const
    })
    return union({ all: boolean(), object: object(Object.fromEntries(subProjection), { strict: true }) })
    /*
    //NEED FOR TYPE NAME
    type U = { //A
        firstName: string
        lastName: string
        likes: number
        a: number
    } | { //B
        firstName: string
        lastName: string
        jobs: number
        a: { a: number }
    }
    type UProjection = true | { 
        A: true | {
            firstName?: true
            lastName?: true
            likes?: true
            a?: true
        },
        B: true | {
            firstName?: true
            lastName?: true
            jobs?: true
            a?: true | { a?: true }
        }
    }
    */
  }
  assertNever(type)
}
