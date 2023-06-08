import { GenericProjection, LazyType, getFirstConcreteType, hasDecorator, lazyToType } from '@mondrian-framework/model'
import { deepMerge } from '@mondrian-framework/utils'

export function projectionToSelection<T extends Record<string, unknown>>(
  type: LazyType,
  projection: GenericProjection | undefined,
  overrides?: T,
): T {
  const select = projectionToSelectionInternal<T>(type, projection)
  if (overrides) {
    return mergeSelections(select, overrides)
  }
  return select
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
      return selection as any
    }
    const selection = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, t]) => {
        if (getFirstConcreteType(t).kind === 'union-operator') {
          return []
        }
        if (projection[k]) {
          const subSelection = projectionToSelectionInternal(t, projection[k])
          if (hasDecorator(t, 'relation-decorator')) {
            return [[k, { select: subSelection }]]
          }
          return [[k, subSelection]]
        }
        return []
      }),
    )
    return selection as any
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
  return true as any
}

export function mergeSelections<T extends Record<string, unknown>>(select: T, overrides: T): T {
  return deepMerge(select, overrides) as T
}
