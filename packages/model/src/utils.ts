import { model } from '.'
import { mapObject } from '@mondrian-framework/utils'

type TypeTransformer<T extends model.Type> = (type: T) => model.Type
export function memoizeTypeTransformation<T extends model.Type>(mapper: TypeTransformer<T>): (type: T) => model.Type {
  const cache = new Map<model.Type, model.Type>()
  return (type: T) => {
    const cachedResult = cache.get(type)
    if (cachedResult) {
      return cachedResult
    }
    if (typeof type === 'function') {
      const lazyResult = () => mapper(type)
      cache.set(type, lazyResult)
      return lazyResult
    }
    const result = mapper(type)
    cache.set(type, result)
    return result
  }
}

export function memoizeTransformation<T, R>(mapper: (t: T) => R): (t: T) => R {
  const cache: Map<T, R> = new Map()
  function f(t: T): R {
    const cachedResult = cache.get(t)
    if (cachedResult) {
      return cachedResult
    }
    const result = mapper(t)
    cache.set(t, result)
    return result
  }
  return f
}

export const forbiddenObjectFields = [
  '',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  '__proto__',
]
export function assertSafeObjectFields(record: Record<string, unknown>) {
  const keys = Object.keys(record)
  for (const field of forbiddenObjectFields) {
    if (keys.includes(field)) {
      throw new Error(`Forbidden field name on object: "${field}"`)
    }
  }
}

export type RichField<T extends model.Type = model.Type> = { field: T; description?: string }
export type RichFields = { readonly [K in string]: model.Type | RichField }

//prettier-ignore
export type RichFieldsToTypes<Ts extends RichFields> = {
  readonly [K in keyof Ts]
    : Ts[K] extends { field: infer T extends model.Type } ? T
    : Ts[K] extends model.Type ? Ts[K]
    : any
}

export function richFieldsToTypes<Ts extends RichFields>(
  richTypes: Ts,
): {
  types: RichFieldsToTypes<Ts>
  fields?: model.ObjectTypeOptions['fields']
} {
  const fields: model.ObjectTypeOptions['fields'] = {}
  const types = mapObject(richTypes, (k, t) => {
    if ('field' in t) {
      fields[k] = { description: t.description }
      return t.field
    } else {
      return t
    }
  })
  return { types: types as RichFieldsToTypes<Ts>, fields: Object.keys(fields).length === 0 ? undefined : fields }
}
