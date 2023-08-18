import { types, projection } from '@mondrian-framework/model'
import { deepMerge } from '@mondrian-framework/utils'

export function projectionToSelection<T extends Record<string, unknown>>(
  type: types.Type,
  projection: projection.Projection | undefined,
  overrides?: T,
): T {
  const select = projectionToSelectionInternal<T>(type, projection)
  if (overrides) {
    return mergeSelections(select.select as T, overrides)
  }
  return select.select as T
}
function projectionToSelectionInternal<T extends Record<string, unknown>>(
  type: types.Type,
  projection: projection.Projection | undefined,
): T {
  const t = types.concretise(type)
  if (t.kind === types.Kind.Object) {
    if (projection === true || projection == null) {
      const selection = Object.fromEntries(
        Object.entries(t.fields).flatMap(([k, t]) => {
          if (types.isReference(t as types.Type)) {
            return []
          }
          return [[k, true]]
        }),
      )
      return { select: selection } as any
    }
    const selection = Object.fromEntries(
      Object.entries(t.fields).flatMap(([k, t]) => {
        const concreteType = types.unwrap(t as types.Type)
        if (concreteType.kind === types.Kind.Union) {
          return []
        }
        if (projection[k]) {
          const subSelection = projectionToSelectionInternal(t as types.Type, projection[k])
          if (concreteType.kind === types.Kind.Object || types.isReference(t as types.Type)) {
            return [[k, subSelection]]
          }
          return [[k, subSelection.select]]
        }
        return []
      }),
    )
    return { select: selection } as any
  }
  if ('wapperdType' in t) {
    return projectionToSelectionInternal(t.wapperdType as types.Type, projection)
  }
  if (t.kind === types.Kind.Union) {
    throw new Error('PrismaUtils does not support union type')
  }
  return { select: true } as any
}

export function mergeSelections<T extends Record<string, unknown>>(select: T, overrides: T): T {
  return deepMerge(select, overrides) as T
}
