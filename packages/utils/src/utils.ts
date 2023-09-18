export type JSONType = string | number | boolean | null | { [K in string]: JSONType } | JSONType[]

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
    Object.entries(object).flatMap(([fieldName, fieldValue]) => {
      const mappedValue = mapper(fieldName, fieldValue)
      return [[fieldName, mappedValue]]
    }),
  )
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

export function count<A>(values: A[]): Map<A, number> {
  return values.reduce(increaseCount, new Map<A, number>())
}

function increaseCount<A>(map: Map<A, number>, key: A): Map<A, number> {
  const value = map.get(key)
  if (value) {
    map.set(key, value + 1)
  } else {
    map.set(key, 1)
  }
  return map
}
