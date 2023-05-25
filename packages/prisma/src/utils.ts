import { GenericProjection, LazyType, getFirstConcreteType, hasDecorator, lazyToType } from '@mondrian/model'

export function projectionToSelection<T extends Record<string, unknown>>(
  projection: GenericProjection | undefined,
  type: LazyType,
  overrides?: T,
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
          const subSelection = projectionToSelection(projection[k], t, (overrides ?? ({} as any))[k])
          if (hasDecorator(t, 'relation-decorator')) {
            return [[k, { ...(overrides ?? ({} as any))[k], select: subSelection }]]
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
    return projectionToSelection(projection, t.type, overrides)
  }
  if (t.kind === 'union-operator') {
    throw new Error('PrismaUtils does not support union type')
  }
  return true as any
}
