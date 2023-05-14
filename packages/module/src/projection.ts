import { LazyType, boolean, lazyToType, object, optional, union } from '@mondrian/model'
import { assertNever } from '@mondrian/utils'

export type GenericProjection = true | { [K in string]?: true | GenericProjection }

export function getProjectionType(type: LazyType, discriminantKey?: string): LazyType {
  if (typeof type === 'function') {
    return () => lazyToType(getProjectionType(lazyToType(type), discriminantKey))
  }
  if (
    type.kind === 'boolean' ||
    type.kind === 'string' ||
    type.kind === 'number' ||
    type.kind === 'enumerator' ||
    type.kind === 'custom' ||
    type.kind === 'literal'
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
            if (k === discriminantKey) {
              return [k, t]
            } else {
              return [k, optional(t)]
            }
          }),
        ),
        { strict: true },
      ),
    })
  }
  if (
    type.kind === 'array-decorator' ||
    type.kind === 'optional-decorator' ||
    type.kind === 'default-decorator' ||
    type.kind === 'reference-decorator'
  ) {
    return getProjectionType(type.type, discriminantKey)
  }
  if (type.kind === 'union-operator') {
    const subProjection = Object.entries(type.types).flatMap(([k, t]) => {
      if (lazyToType(t).kind !== 'object') {
        return []
      }
      return [[k, optional(getProjectionType(t, type.opts?.discriminant))]] as const
    })
    return union({ all: boolean(), object: object(Object.fromEntries(subProjection), { strict: true }) })
  }
  assertNever(type)
}
