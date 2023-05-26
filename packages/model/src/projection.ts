import { LazyType, array, boolean, object, optional, union, nullable } from './type-system'
import { assertNever } from '@mondrian-framework/utils'
import { lazyToType } from './utils'

export type GenericProjection = true | { [K in string]?: true | GenericProjection }

export function getProjectedType(type: LazyType, projection: GenericProjection | undefined): LazyType {
  if (projection === undefined || projection === true) {
    return ignoreRelations(type)
  }
  if (typeof type === 'function') {
    return () => lazyToType(getProjectedType(lazyToType(type), projection))
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
    return array(getProjectedType(type.type, projection))
  }
  if (type.kind === 'optional-decorator') {
    return optional(getProjectedType(type.type, projection))
  }
  if (type.kind === 'nullable-decorator') {
    return nullable(getProjectedType(type.type, projection))
  }
  if (type.kind === 'default-decorator') {
    return getProjectedType(type.type, projection)
  }
  if (type.kind === 'relation-decorator') {
    return getProjectedType(type.type, projection)
  }
  if (type.kind === 'union-operator') {
    return union(
      Object.fromEntries(
        Object.entries(projection).map(([k, v]) => {
          return [k, getProjectedType(type.types[k], v)]
        }),
      ),
    )
  }
  if (type.kind === 'object') {
    return object(
      Object.fromEntries(
        Object.entries(projection).map(([k, v]) => {
          return [k, getProjectedType(type.type[k], v)]
        }),
      ),
      { strict: true },
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

export function getProjectionType(type: LazyType): LazyType {
  if (typeof type === 'function') {
    return () => lazyToType(getProjectionType(lazyToType(type)))
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
            return [k, optional(t)]
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
    return getProjectionType(type.type)
  }
  if (type.kind === 'union-operator') {
    const subProjection = Object.entries(type.types).flatMap(([k, t]) => {
      if (lazyToType(t).kind !== 'object') {
        return []
      }
      return [[k, optional(getProjectionType(t))]] as const
    })
    return union({ all: boolean(), object: object(Object.fromEntries(subProjection), { strict: true }) })
  }
  assertNever(type)
}

type projectionKeys<T extends GenericProjection | undefined> = T extends Record<string, GenericProjection>
  ? keyof T
  : never
type SubProjection<T extends GenericProjection | undefined, K extends projectionKeys<T>> = T extends undefined
  ? undefined
  : T extends true
  ? true
  : T extends Record<string, GenericProjection>
  ? T[K]
  : never

export function subProjection<const T extends GenericProjection | undefined, const K extends projectionKeys<T>>(
  projection: T,
  v: K,
): SubProjection<T, K> {
  if (projection === undefined || projection === true) {
    return projection as any
  }
  return (projection as any)[v]
}

export type MergeGenericProjection<T1 extends GenericProjection, T2 extends GenericProjection> = [T1] extends [true]
  ? T1
  : [T2] extends [true]
  ? T2
  : {
      [K in keyof T1 | keyof T2]: [T1] extends [Record<K, GenericProjection>]
        ? [T2] extends [Record<K, GenericProjection>]
          ? MergeGenericProjection<T1[K], T2[K]>
          : T1[K]
        : [T2] extends [Record<K, GenericProjection>]
        ? T2[K]
        : never
    }
export function mergeProjections<const P1 extends GenericProjection, const P2 extends GenericProjection>(
  p1: P1,
  p2: P2,
): MergeGenericProjection<P1, P2> {
  if (p1 === true || p2 === true) return true as MergeGenericProjection<P1, P2>
  if (p1 === null || p1 === undefined) return p2 as MergeGenericProjection<P1, P2>
  if (p2 === null || p2 === undefined) return p1 as MergeGenericProjection<P1, P2>
  const p1k = Object.keys(p1)
  const p2k = Object.keys(p2)
  const keySet = new Set([...p1k, ...p2k])
  const res: Record<string, GenericProjection> = {}
  for (const key of keySet.values()) {
    res[key] = mergeProjections(p1[key] as GenericProjection, p2[key] as GenericProjection)
  }
  return res as MergeGenericProjection<P1, P2>
}

export function getRequiredProjection(type: LazyType, projection: GenericProjection): GenericProjection | null {
  if (projection === true) {
    return null
  }
  const t = lazyToType(type)
  if (
    t.kind === 'boolean' ||
    t.kind === 'string' ||
    t.kind === 'number' ||
    t.kind === 'enumerator' ||
    t.kind === 'custom' ||
    t.kind === 'literal'
  ) {
    return null
  }
  if (
    t.kind === 'array-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'nullable-decorator' ||
    t.kind === 'default-decorator' ||
    t.kind === 'relation-decorator'
  ) {
    return getRequiredProjection(t.type, projection)
  }
  if (t.kind === 'object') {
    const p = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, type]) => {
        const subF = projection[k]
        if (!subF) {
          return []
        }
        const subP = getRequiredProjection(type, subF)
        return subP != null ? [[k, subP]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  if (t.kind === 'union-operator') {
    const p = Object.fromEntries(
      Object.entries(t.types).flatMap(([k, type]) => {
        const subF = projection[k]
        if (!subF && !t.opts?.discriminant) {
          return []
        }
        const subP = subF ? getRequiredProjection(type, subF) : null
        const reqP = t.opts?.discriminant ? ({ [t.opts!.discriminant!]: true } as GenericProjection) : null
        const res = subP && reqP ? mergeProjections(reqP, subP) : reqP
        return res != null ? [[k, res]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  assertNever(t)
}
