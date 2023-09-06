import { path } from 'src'

/**
 * @param message the message to display in the error
 * @throws an Error with the `[internal error]` header and an additional message
 *         redirecting to the project's issue page
 */
export function failWithInternalError(message: string): never {
  const header = '[internal error]'
  const mondrianIssueUrl = 'https://github.com/twinlogix/mondrian-framework/issues'
  const reportMessage = `If you think this could be a bug in the framework, please report it at ${mondrianIssueUrl}`
  throw Error(`${header} ${message}\n${reportMessage}`)
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
 * @param taggedVariant an object that should represent a tagged variant (that is, it has a single field)
 * @returns a tuple with the name of the single field of the object and its value
 * @throws an {@link failWithInternalError internal error} if the given object has 0 or more than one fields
 *         this function should only be used for internal purposes _if you are 100% sure_ that the given
 *         object is a tagged variant
 * @example ```ts
 *          unsafeObjectToTaggedVariant({ foo: 1 }) // -> ["foo", 1]
 *          unsafeObjectToTaggedVariant({}) // -> Exception!
 *          unsafeObjectToTaggedVariant({ foo: 1, bar: 1 }) // -> Exception!
 *          ```
 */
export function unsafeObjectToTaggedVariant<T>(taggedVariant: Record<string, T>): [string, T] {
  if (taggedVariant) {
    const entries = Object.entries(taggedVariant)
    const entry = entries[0]
    return entry ? entry : failWithInternalError('I tried to get the variant name out of an empty object')
  } else {
    failWithInternalError('I tried to get the variant name out of a null or undefined object')
  }
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

/**
 * @param values an array of item that all have a `path` field
 * @param variantName the variant to prepend to the path of each item of the given array
 * @returns an array of item with the path updated with the prepended variant
 */
export function prependVariantToAll<Data extends Record<string, any>, T extends WithPath<Data>>(
  values: T[],
  variantName: string,
): T[] {
  return values.map((value) => ({ ...value, path: value.path.prependVariant(variantName) }))
}
