import { model } from '.'

/**
 * Applies the mapping logic of a type in a lazy fashion.
 * It respects the lazyness depth.
 *
 * @example
 *
 * ```typescript
 * const m = () => () => () => model.string()
 * const mapped = lazyMap(m, (t) => { ... }) // it's of type () => () => () => [MAPPED]
 * ```
 * @param type the type to map
 * @param mapper the mapper function
 */
export function lazyMap<T extends model.Type>(type: T, mapper: TypeTransformer<T>): T {
  if (typeof type === 'function') {
    let concreteType: model.Type = type()
    let depth = 1
    while (typeof concreteType === 'function') {
      concreteType = concreteType() as T
      depth++
    }
    const namedConcreteType =
      concreteType.options?.name === undefined && type.name ? concreteType.setName(type.name) : concreteType
    return lazyfy(depth, () => mapper(namedConcreteType as T, type)) as T
  } else {
    return mapper(type, type) as T
  }
}

function lazyfy<T>(depth: number, value: () => T): T {
  if (depth > 0) {
    return (() => lazyfy(depth - 1, value)) as T
  }
  return value()
}

type TypeTransformer<T extends model.Type> = (type: T, lazyType: T) => model.Type
export function memoizeTypeTransformation<T extends model.Type>(mapper: TypeTransformer<T>): (type: T) => model.Type {
  const cache = new Map<model.Type, model.Type>()
  return (type: T) => {
    const cachedResult = cache.get(type)
    if (cachedResult) {
      return cachedResult
    }
    if (typeof type === 'function') {
      const lazyResult = lazyMap(type, mapper)
      //const lazyResult = () => mapper(model.concretise(type), type)
      cache.set(type, lazyResult)
      return lazyResult
    }
    const result = mapper(type, type)
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
      throw new Error(`Forbidden field name on object: ${field}`)
    }
  }
}
