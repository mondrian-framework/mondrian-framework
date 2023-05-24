import { LazyType, array, boolean, object, optional, union, nullable } from './type-system'
import { assertNever } from '@mondrian/utils'
import { lazyToType } from './utils'

export type GenericProjection = true | { [K in string]?: true | GenericProjection }

export function getProjectedType(type: LazyType, fields: GenericProjection | undefined): LazyType {
  if (fields === undefined || fields === true) {
    return ignoreRelations(type)
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
  if (type.kind === 'nullable-decorator') {
    return nullable(getProjectedType(type.type, fields))
  }
  if (type.kind === 'default-decorator') {
    return getProjectedType(type.type, fields)
  }
  if (type.kind === 'relation-decorator') {
    return getProjectedType(type.type, fields)
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

function ignoreRelations(type: LazyType): LazyType {
  if (typeof type === 'function') {
    return () => lazyToType(ignoreRelations(lazyToType(type)))
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
    return array(ignoreRelations(type.type))
  }
  if (type.kind === 'optional-decorator') {
    return optional(ignoreRelations(type.type))
  }
  if (type.kind === 'nullable-decorator') {
    return nullable(ignoreRelations(type.type))
  }
  if (type.kind === 'default-decorator') {
    return ignoreRelations(type.type)
  }
  if (type.kind === 'relation-decorator') {
    return optional(ignoreRelations(type.type))
  }
  if (type.kind === 'union-operator') {
    return union(Object.fromEntries(Object.entries(type.types).map(([k, t]) => [k, ignoreRelations(t)])))
  }
  if (type.kind === 'object') {
    return object(
      Object.fromEntries(
        Object.entries(type.type).map(([k, lt]) => {
          return [k, ignoreRelations(lt)]
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
    type.kind === 'nullable-decorator' ||
    type.kind === 'default-decorator' ||
    type.kind === 'relation-decorator'
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

type FieldsKeys<T extends GenericProjection | undefined> = T extends Record<string, GenericProjection> ? keyof T : never
type SubFieldsSelection<T extends GenericProjection | undefined, K extends FieldsKeys<T>> = T extends undefined
  ? undefined
  : T extends true
  ? true
  : T extends Record<string, GenericProjection>
  ? T[K]
  : never

export function subFields<const T extends GenericProjection | undefined, const K extends FieldsKeys<T>>(
  fields: T,
  v: K,
): SubFieldsSelection<T, K> {
  if (fields === undefined || fields === true) {
    return fields as any
  }
  return (fields as any)[v]
}
