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

export function assertNever(t: never): never {
  throw new Error(`Unreachable`)
}

export function setTraversingValue(value: unknown, path: string, object: Record<string, unknown>) {
  const [head, ...tail] = path.split('.')
  if (tail.length === 0) {
    object[head] = value
    return
  }
  if (!object[head]) {
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
  mapper: (fieldName: string, fieldValue: A) => [string, B][],
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

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

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
  return list.reduce((previous, currentItem) => {
    const group = getKey(currentItem)
    if (!previous[group]) {
      previous[group] = []
    }
    previous[group].push(currentItem)
    return previous
  }, {} as Record<K, O[]>)
}
