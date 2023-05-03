import { LazyType, boolean, object, optional, tuple, union } from './type-system'
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
    return union([
      boolean(),
      object(
        Object.fromEntries(
          Object.entries(type.type).map(([k, v]) => {
            const t = getProjectionType(v)
            return [k, optional(t)]
          }),
        ),
      ),
    ])
  }
  if (type.kind === 'array-decorator' || type.kind === 'optional-decorator' || type.kind === 'default-decorator' || type.kind === 'name-decorator') {
    return getProjectionType(type.type)
  }
  if (type.kind === 'union-operator' || type.kind === 'tuple-decorator') {
    const subProjection = type.types.map((t) => getProjectionType(t)) as [LazyType, LazyType, ...LazyType[]]
    return union([boolean(), tuple(subProjection)])
    /*
    //NEED FOR TYPE NAME
    type U = {
        firstName: string
        lastName: string
        likes: number
        a: number
    } | {
        firstName: string
        lastName: string
        jobs: number
        a: { a: number }
    }
    type UProjection = true | [
        true | {
            firstName?: true
            lastName?: true
            likes?: true
            a?: true
        },
        true | {
            firstName?: true
            lastName?: true
            jobs?: true
            a?: true | { a?: true }
        }
    ]
    */
  }
  assertNever(type)
}
