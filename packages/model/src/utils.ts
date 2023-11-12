import { model } from '.'

type TypeTransformer<T extends model.Type> = (type: T, lazyType: T) => model.Type
export function memoizeTypeTransformation<T extends model.Type>(mapper: TypeTransformer<T>): (type: T) => model.Type {
  const cache = new Map<model.Type, model.Type>()
  return (type: T) => {
    const cachedResult = cache.get(type)
    if (cachedResult) {
      return cachedResult
    }
    if (typeof type === 'function') {
      const lazyResult = () => mapper(model.concretise(type), type)
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
