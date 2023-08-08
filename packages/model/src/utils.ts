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
  const mappedObject: { [key: string]: B } = {}
  for (const [fieldName, fieldValue] of Object.entries(object)) {
    const mappedValue = mapper(fieldName, fieldValue)
    if (mappedValue !== undefined) {
      mappedObject[fieldName] = mappedValue
    }
  }
  return mappedObject
}

/**
 *
 * @param message the message to display in the error
 * @returns a TypeScript `Error` where
 */
export function failWithInternalError(message: string): never {
  const header = '[INTERNAL ERROR]'
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
export function areSameArray<A>(one: A[], other: A[], compare: (one: A, other: A) => boolean): boolean {
  return one === other || (one.length === other.length && one.every((value, i) => compare(value, other[i])))
}

export function assertNever(_value: never, errorMessage: string): never {
  failWithInternalError(errorMessage)
}
