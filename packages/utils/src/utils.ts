export type JSONType =
  | string
  | number
  | boolean
  | null
  | { readonly [K in string]?: JSONType }
  | { [K in string]?: JSONType }
  | JSONType[]
  | readonly JSONType[]

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

export type KeysOfUnion<T> = T extends T ? keyof T : never

export type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key]
}

/**
 * @param message the message to display in the error
 * @throws an Error with the `[internal error]` header and an additional message
 *         redirecting to the project's issue page
 */
export function failWithInternalError(message: string): never {
  throw new Error(buildErrorMessage(message))
}

/**
 * Builds an internal error message for the Mondrian-Framework.
 */
export function buildErrorMessage(message: string, location?: string): string {
  const header = '[Mondrian-Framework internal error]'
  const mondrianIssueUrl = 'https://github.com/mondrian-framework/mondrian-framework/issues'
  const reportMessage = `If you think this could be a bug in the framework, please report it at ${mondrianIssueUrl}`
  return location
    ? `${header} ${message}\n(at ${location})\n${reportMessage}`
    : `${header} ${message}\n${reportMessage}`
}

/**
 * @param _ a value that must be inferred as of type never
 * @param errorMessage the error message to throw in case this function is actually called
 * @throws an {@link failWithInternalError internal error} with the given message
 */
export function assertNever(_: never, errorMessage: string): never {
  failWithInternalError(errorMessage)
}

/**
 * Sets a value on an object based on a path.
 * @param value the value to set.
 * @param path the dot notated path (example a.b.c)
 * @param object the object where apply the side effetct.
 */
export function setTraversingValue(value: unknown, path: string, object: Record<string, unknown>): void {
  const [head, ...tail] = path.split('.')
  if (tail.length === 0) {
    object[head] = value
    return
  }
  const root = object[head]
  if (root == null || typeof root !== 'object') {
    object[head] = {}
  }
  setTraversingValue(value, tail.join('.'), object[head] as Record<string, unknown>)
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function deepMerge(weak: any, strong: any): unknown {
  if (weak === undefined) {
    return strong
  }
  if (strong === undefined) {
    return weak
  }
  if (!isPlainObject(weak) || !isPlainObject(strong)) {
    return strong
  }
  const strongKey = new Set(Object.keys(strong))
  const weakKey = new Set(Object.keys(weak))
  const keySet = new Set([...strongKey, ...weakKey])
  const result: Record<string, unknown> = {}
  keySet.forEach((k) => {
    const [s, w] = [strongKey.has(k), weakKey.has(k)]
    if (s && w) {
      result[k] = deepMerge(weak[k], strong[k])
    } else if (s) {
      result[k] = strong[k]
    } else {
      result[k] = weak[k]
    }
  })
  return result
}

//https://github.com/microsoft/TypeScript/issues/17002
export const isArray = Array.isArray as <T extends readonly any[]>(obj: unknown) => obj is T

//https://github.com/jonschlinkert/is-plain-object
function isObject(o: unknown): boolean {
  return Object.prototype.toString.call(o) === '[object Object]'
}
export function isPlainObject(o: unknown): boolean {
  var ctor, prot

  if (isObject(o) === false) return false

  // If has modified constructor
  ctor = (o as any).constructor
  if (ctor === undefined) return true

  // If has modified prototype
  prot = ctor.prototype
  if (isObject(prot) === false) return false

  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty('isPrototypeOf') === false) {
    return false
  }

  // Most likely a plain Object
  return true
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
    Object.entries(object).map(([fieldName, fieldValue]) => {
      const mappedValue = mapper(fieldName, fieldValue)
      return [fieldName, mappedValue]
    }),
  )
}

/**
 * @param object the object to flatmap over
 * @param mapper a mapping function that takes as input the name of a field and the corresponding value and maps it to
 *               an array of name & value of type `B`
 * @returns a new object with the mapped fields
 */
export function flatMapObject<A, B>(
  object: Record<string, A>,
  mapper: (fieldName: string, fieldValue: A) => readonly (readonly [string, B])[],
): Record<string, B> {
  return Object.fromEntries(Object.entries(object).flatMap(([fieldName, fieldValue]) => mapper(fieldName, fieldValue)))
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
 * Transforms a union to intersection. Example:
 * ```
 * type A = { a: string }
 * type B = { b: string }
 * type C = UnionToIntersection<A | B> // A & B -> { a: string, b: string }
 * ```
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/**
 * ```
 * type A = { a: string; b: string }
 * type B = AtLeastOnePropertyOf<A> // { a: string; b?: string } | { b: string; a?: string }
 * ```
 */
export type AtLeastOnePropertyOf<T> = {
  [K in keyof T]: { [L in K]: T[L] } & { [L in Exclude<keyof T, K>]?: T[L] }
}[keyof T]

/**
 * Checks if two json are the same by value.
 */
export function areJsonsEquals(left: JSONType, right: JSONType): boolean {
  if (left === right) {
    return true
  }
  if (typeof left === 'object' && typeof right === 'object') {
    if (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((l, i) => areJsonsEquals(l, right[i]))
    ) {
      return true
    }
    if (left && right) {
      //two objects
      if (
        Object.entries(left).filter((v) => v[1] !== undefined).length !==
        Object.entries(right).filter((v) => v[1] !== undefined).length
      ) {
        return false
      }
      for (const [key, leftValue] of Object.entries(left)) {
        const rightValue = (right as Record<string, JSONType>)[key]
        if (leftValue === undefined && rightValue === undefined) {
          continue
        }
        if (leftValue === undefined || rightValue === undefined || !areJsonsEquals(leftValue, rightValue)) {
          return false
        }
      }
      return true
    }
  }
  return false
}

/**
 * @param word
 * @returns a new string where the first letter is a capital letter
 */
export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * @param word
 * @returns a new string where the first letter is not a capital letter
 */
export function uncapitalise(word: string): string {
  return word.charAt(0).toLocaleLowerCase() + word.slice(1)
}

/**
 * @param text the text to turn into camel case
 * @returns a new string where each space has been removed and all words
 *          have been capitalised
 */
export function toCamelCase(text: string): string {
  return text.split(/\s+/).map(capitalise).join('')
}

/**
 * Groups the list element base on a string property.
 */
export function groupBy<O, K extends string>(list: O[], getKey: (item: O) => K): Record<K, O[]> {
  return list.reduce(
    (map, item) => {
      const group = getKey(item)
      const list = map[group]
      if (!list) {
        map[group] = [item]
      } else {
        list.push(item)
      }
      return map
    },
    {} as Record<K, O[]>,
  )
}

/**
 * Reverses a string.
 */
export function reverseStr(str: string): string {
  return [...str].reverse().join('')
}

/**
 * Replaces the last occurrence of a string in a string.
 */
export function replaceLast(str: string, toFind: string, toReplace: string): string {
  return reverseStr(reverseStr(str).replace(reverseStr(toFind), reverseStr(toReplace)))
}
