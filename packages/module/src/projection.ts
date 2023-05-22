import { LazyType, array, boolean, lazyToType, preset, object, optional, union, hide } from '@mondrian/model'
import { assertNever } from '@mondrian/utils'

export type GenericProjection = true | { [K in string]?: true | GenericProjection }

export function getProjectedType(type: LazyType, fields: GenericProjection | undefined): LazyType {
  if (fields === undefined || fields === true) {
    return ignoreHides(type)
  }
  if (typeof type === 'function') {
    return () => lazyToType(getProjectedType(lazyToType(type), fields))
  }
  if (
    type.kind === 'boolean' ||
    type.kind === 'string' ||
    type.kind === 'number' ||
    type.kind === 'enumerator' ||
    type.kind === 'custom' ||
    type.kind === 'literal'
  ) {
    return type
  }
  if (type.kind === 'array-decorator') {
    return array(getProjectedType(type.type, fields))
  }
  if (type.kind === 'optional-decorator') {
    return optional(getProjectedType(type.type, fields))
  }
  if (type.kind === 'default-decorator') {
    return preset(getProjectedType(type.type, fields), type.opts)
  }
  if (type.kind === 'hide-decorator') {
    return hide(getProjectedType(type.type, fields))
  }
  if (type.kind === 'union-operator') {
    return union(
      Object.fromEntries(
        Object.entries(fields).map(([k, v]) => {
          return [k, getProjectedType(type.types[k], v)]
        }),
      ),
    )
  }
  if (type.kind === 'object') {
    return object(
      Object.fromEntries(
        Object.entries(fields).map(([k, v]) => {
          return [k, getProjectedType(type.type[k], v)]
        }),
      ),
    )
  }
  assertNever(type)
}

function ignoreHides(type: LazyType): LazyType {
  if (typeof type === 'function') {
    return () => lazyToType(ignoreHides(lazyToType(type)))
  }
  if (
    type.kind === 'boolean' ||
    type.kind === 'string' ||
    type.kind === 'number' ||
    type.kind === 'enumerator' ||
    type.kind === 'custom' ||
    type.kind === 'literal'
  ) {
    return type
  }
  if (type.kind === 'array-decorator') {
    return array(ignoreHides(type.type))
  }
  if (type.kind === 'optional-decorator') {
    return optional(ignoreHides(type.type))
  }
  if (type.kind === 'default-decorator') {
    return preset(ignoreHides(type.type), type.opts)
  }
  if (type.kind === 'hide-decorator') {
    return hide(ignoreHides(type.type))
  }
  if (type.kind === 'union-operator') {
    return union(Object.fromEntries(Object.entries(type.types).map(([k, t]) => [k, ignoreHides(t)])))
  }
  if (type.kind === 'object') {
    return object(
      Object.fromEntries(
        Object.entries(type.type).map(([k, lt]) => {
          if (typeof lt === 'function') {
            return [
              k,
              () => {
                const t = lazyToType(lt)
                if (t.kind === 'hide-decorator') {
                  return optional(t)
                }
                return t
              },
            ]
          }
          if (lt.kind === 'hide-decorator') {
            return [k, optional(lt)]
          }
          return [k, lt]
        }),
      ),
      type.opts,
    )
  }
  assertNever(type)
}

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
    type.kind === 'hide-decorator'
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
