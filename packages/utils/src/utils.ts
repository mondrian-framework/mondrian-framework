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
