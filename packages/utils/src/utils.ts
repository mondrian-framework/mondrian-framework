export type JSONType = string | number | boolean | null | undefined | { [K in string]: JSONType } | JSONType[]

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
