import { model } from '.'

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
