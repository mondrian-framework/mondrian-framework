import { path } from 'src'

/**
 * @param values the array to map over
 * @param mapper a mapping function that may return `undefined`
 * @returns a new array where each element has been mapped with `mapper` and all values mapped to `undefined` are
 *          discarted
 */
export function filterMap<A, B>(values: A[], mapper: (_: A) => B | undefined): B[] {
  const mappedValues = []
  for (const value of values) {
    const mappedValue = mapper(value)
    if (mappedValue !== undefined) {
      mappedValues.push(mappedValue)
    }
  }
  return mappedValues
}

/**
 * @param object the object to map over
 * @param mapper a mapping function that takes as input the name of a field and the corresponding value and maps it to
 *               a value of type `B` or `undefined`
 * @returns a new object with the same fields where each value is mapped using the mapping function, any value mapped to
 *          `undefined` is discarded and the corresponding field is dropped from the new object
 */
export function filterMapObject<A, B>(
  object: Record<string, A>,
  mapper: (fieldName: string, fieldValue: A) => B | undefined,
): Record<string, B> {
  return Object.fromEntries(
    Object.entries(object).flatMap(([fieldName, fieldValue]) => {
      const mappedValue = mapper(fieldName, fieldValue)
      return mappedValue !== undefined ? [[fieldName, mappedValue]] : []
    }),
  )
}

/**
 * @param object the object to map over
 * @param mapper a mapping function that takes as input the name of a field and the corresponding value and maps it to
 *               a value of type `B`
 * @returns a new object with the same fields where each value is mapped using the mapping function
 */
export function mapObject<A, B>(
  object: Record<string, A>,
  mapper: (fieldName: string, fieldValue: A) => B,
): Record<string, B> {
  return Object.fromEntries(
    Object.entries(object).flatMap(([fieldName, fieldValue]) => {
      const mappedValue = mapper(fieldName, fieldValue)
      return [[fieldName, mappedValue]]
    }),
  )
}

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
 * @param one the first array to compare
 * @param other the second array to compare
 * @param compare the function used to compare the arrays' objects
 * @returns true if the array are equal element by element
 */
export function areSameArray<A>(
  one: readonly A[],
  other: readonly A[],
  compare: (one: A, other: A) => boolean,
): boolean {
  return one === other || (one.length === other.length && one.every((value, i) => compare(value, other[i])))
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
 * @param value
 * @returns a function that always returns the given value, no matter the input
 * @example ```ts
 *          always(1)(true) // -> 1
 *          always("foo")(10) // -> "foo"
 *          ```
 */
export function always<A>(value: A): (_: any) => A {
  return (_) => value
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
 * @param one the array to merge with `other`
 * @param other the array to merge with the first one
 * @returns a new array obtained by concatenating `other` to `one`
 * @example ```ts
 *          mergeArrays([1, 2], [3, 4, 5]) // -> [1, 2, 3, 4, 5]
 *          ```
 */
export function mergeArrays<A>(one: readonly A[], other: readonly A[]): A[] {
  return [...one, ...other]
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
