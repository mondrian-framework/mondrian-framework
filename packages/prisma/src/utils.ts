import { GenericProjection, LazyType, hasDecorator, lazyToType } from '@mondrian/model'

export function fieldsToSelection<T extends Record<string, unknown>>(
  fields: GenericProjection | undefined,
  type: LazyType,
  overrides?: T,
): T {
  const t = lazyToType(type)
  if (t.kind === 'object') {
    if (fields === true || fields == null) {
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
        if (fields[k]) {
          const subSelection = fieldsToSelection(fields[k], t, (overrides ?? ({} as any))[k])
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
    return fieldsToSelection(fields, t.type, overrides)
  }
  if (t.kind === 'union-operator') {
    throw new Error('TODO')
  }
  return true as any
}
