import { path, model } from '.'

/**
 * @param message the message to display in the error
 * @throws an Error with the `[internal error]` header and an additional message
 *         redirecting to the project's issue page
 */
export function failWithInternalError(message: string): never {
  const header = '[internal error]'
  const mondrianIssueUrl = 'https://github.com/twinlogix/mondrian-framework/issues'
  const reportMessage = `If you think this could be a bug in the framework, please report it at ${mondrianIssueUrl}`
  throw new Error(`${header} ${message}\n${reportMessage}`)
}

/**
 * @param _value a value that must be inferred as of type never
 * @param errorMessage the error message to throw in case this function is actually called
 * @throws an {@link failWithInternalError internal error} with the given message
 */
export function assertNever(_value: never, errorMessage: string): never {
  failWithInternalError(errorMessage)
}

/**
 * A type describing objects with a `path` field of type {@link path.Path `Path`}
 */
export type WithPath<Data extends Record<string, any>> = Data & { path: path.Path }

/**
 * @param values an array of item that all have a `path` field
 * @param fieldName the field to prepend to the path of each item of the given array
 * @returns an array of item with the path updated with the prepended field
 */
export function prependFieldToAll<Data extends Record<string, any>, T extends WithPath<Data>>(
  values: T[],
  fieldName: string,
): T[] {
  return values.map((value) => ({ ...value, path: value.path.prependField(fieldName) }))
}

/**
 * @param values an array of item that all have a `path` field
 * @param index the index to prepend to the path of each item of the given array
 * @returns an array of item with the path updated with the prepended index
 */
export function prependIndexToAll<Data extends Record<string, any>, T extends WithPath<Data>>(
  values: T[],
  index: number,
): T[] {
  return values.map((value) => ({ ...value, path: value.path.prependIndex(index) }))
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
