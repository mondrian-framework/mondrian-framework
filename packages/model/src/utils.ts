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
 * @returns a TypeScript `Error` where
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

export function assertNever(_value: never, errorMessage: string): never {
  failWithInternalError(errorMessage)
}

/**
 * @param value
 * @returns a function that always returns the given value, no matter the input
 */
export function always<A>(value: A): (_: any) => A {
  return (_) => value
}

export function unsafeObjectToTaggedVariant<T>(taggedVariant: Record<string, T>): [string, T] {
  if (taggedVariant) {
    const entries = Object.entries(taggedVariant)
    const entry = entries[0]
    return entry ? entry : failWithInternalError('I tried to get the variant name out of an empty object')
  } else {
    failWithInternalError('I tried to get the variant name out of a null or undefined object')
  }
}

export function mergeArrays<A>(one: A[], other: A[]): A[] {
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
