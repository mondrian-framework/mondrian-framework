import { GenericProjection, LazyType, getFirstConcreteType, hasDecorator, lazyToType } from '@mondrian-framework/model'
import { deepMerge } from '@mondrian-framework/utils'

export function projectionToSelection<T extends Record<string, unknown>>(
  type: LazyType,
  projection: GenericProjection | undefined,
  overrides?: T,
): T {
  const select = projectionToSelectionInternal<T>(type, projection)
  if (overrides) {
    return mergeSelections(select.select as T, overrides)
  }
  return select.select as T
}
function projectionToSelectionInternal<T extends Record<string, unknown>>(
  type: LazyType,
  projection: GenericProjection | undefined,
): T {
  const t = lazyToType(type)
  if (t.kind === 'object') {
    if (projection === true || projection == null) {
      const selection = Object.fromEntries(
        Object.entries(t.type).flatMap(([k, t]) => {
          if (hasDecorator(t, 'relation-decorator')) {
            return []
          }
          return [[k, true]]
        }),
      )
      return { select: selection } as any
    }
    const selection = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, t]) => {
        const concreteType = getFirstConcreteType(t)
        if (concreteType.kind === 'union-operator') {
          return []
        }
        if (projection[k]) {
          const subSelection = projectionToSelectionInternal(t, projection[k])
          if (concreteType.kind === 'object' || hasDecorator(t, 'relation-decorator')) {
            return [[k, subSelection]]
          }
          return [[k, subSelection.select]]
        }
        return []
      }),
    )
    return { select: selection } as any
  }
  if (
    t.kind === 'array-decorator' ||
    t.kind === 'default-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'nullable-decorator' ||
    t.kind === 'relation-decorator'
  ) {
    return projectionToSelectionInternal(t.type, projection)
  }
  if (t.kind === 'union-operator') {
    throw new Error('PrismaUtils does not support union type')
  }
  return { select: true } as any
}

export function mergeSelections<T extends Record<string, unknown>>(select: T, overrides: T): T {
  return deepMerge(select, overrides) as T
}
