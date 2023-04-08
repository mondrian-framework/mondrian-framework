import { Expand } from './utils'

export type StringType = { kind: 'string'; opts?: { maxLength?: number; regex?: RegExp; minLength?: number } }
export type CustomType = {
  kind: 'custom'
  type: unknown
  name: string
  opts: { decode: (input: unknown) => unknown; encode: (input: any) => unknown; is: (input: unknown) => boolean }
}
export type Type =
  | { kind: 'object'; type: ObjectType }
  | { kind: 'number' }
  | StringType
  | { kind: 'literal'; values: readonly string[] }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'unknown' }
  | { kind: 'undefined' }
  | { kind: 'array-decorator'; type: LazyType }
  | { kind: 'optional-decorator'; type: LazyType }
  | { kind: 'union'; types: LazyType[] }
  | CustomType

export type LazyType = Type | (() => Type)
export type ObjectType = { [K in string]: LazyType }
export type Types = Record<string, LazyType>

export type Infer<T extends LazyType> = T extends () => infer LT ? InferType<LT> : InferType<T>

type InferType<T> = T extends Type
  ? T extends { kind: 'array-decorator'; type: infer ST }
    ? ST extends LazyType
      ? Infer<ST>[]
      : never
    : T extends { kind: 'optional-decorator'; type: infer ST }
    ? ST extends LazyType
      ? Infer<ST> | undefined
      : never
    : T extends { kind: 'string' }
    ? string
    : T extends { kind: 'number' }
    ? number
    : T extends { kind: 'boolean' }
    ? boolean
    : T extends { kind: 'null' }
    ? null
    : T extends { kind: 'unknown' }
    ? unknown
    : T extends { kind: 'undefined' }
    ? undefined
    : T extends { kind: 'custom'; type: infer C }
    ? C
    : T extends { kind: 'literal'; values: infer V }
    ? V extends readonly string[]
      ? V[number]
      : never
    : T extends { kind: 'union'; types: infer TS }
    ? TS extends Array<any>
      ? Infer<TS[number]>
      : never
    : T extends { kind: 'object'; type: infer ST }
    ? ST extends ObjectType
      ? Expand<
          {
            [K in NonOptionalKeys<ST>]: Infer<ST[K]>
          } & {
            [K in OptionalKeys<ST>]?: Infer<ST[K]>
          }
        >
      : never
    : never
  : never

type OptionalKeys<T extends ObjectType> = {
  [K in keyof T]: T[K] extends { kind: 'optional-decorator'; type: unknown } ? K : never
}[keyof T]
type NonOptionalKeys<T extends ObjectType> = {
  [K in keyof T]: T[K] extends { kind: 'optional-decorator'; type: unknown } ? never : K
}[keyof T]

export type Projection<T> = T extends Date
  ? true | undefined
  : T extends (infer E)[]
  ? Projection<E>
  : T extends object
  ?
      | {
          [K in keyof T]?: Projection<T[K]> | true
        }
      | true
  : true | undefined

export function types<const T extends Types>(types: T): T {
  return types
}
export function object<const T extends ObjectType>(type: T): { kind: 'object'; type: T } {
  return { kind: 'object', type }
}
export function number(): { kind: 'number' } {
  return { kind: 'number' }
}
export function string(opts?: StringType['opts']): StringType {
  return { kind: 'string', opts }
}
export function union<const T1 extends LazyType, const T2 extends LazyType, const TS extends LazyType[]>(
  types: [T1, T2, ...TS],
): { kind: 'union'; types: [T1, T2, ...TS] } {
  return { kind: 'union', types }
}
export function literal<const V extends readonly [string, ...string[]]>(values: V): { kind: 'literal'; values: V } {
  return { kind: 'literal', values }
}
export function boolean(): { kind: 'boolean' } {
  return { kind: 'boolean' }
}
export function date(): { kind: 'date' } {
  return { kind: 'date' }
}
export function unknown(): { kind: 'unknown' } {
  return { kind: 'unknown' }
}
export function nill(): { kind: 'null' } {
  return { kind: 'null' }
}
export function undef(): { kind: 'undefined' } {
  return { kind: 'undefined' }
}
export function array<const T extends LazyType>(type: T): { kind: 'array-decorator'; type: T } {
  return { kind: 'array-decorator', type }
}
export function optional<const T extends LazyType>(type: T): { kind: 'optional-decorator'; type: T } {
  return { kind: 'optional-decorator', type }
}
export function custom<const T>({
  name,
  opts,
}: {
  name: string
  opts: { decode: (input: unknown) => T; encode: (input: T) => unknown; is: (input: unknown) => boolean }
}): {
  kind: 'custom'
  name: string
  type: T
  opts: { decode: (input: unknown) => T; encode: (input: T) => unknown; is: (input: unknown) => boolean }
} {
  return { kind: 'custom', name, opts, type: null as T }
}

export const scalars: {
  timestamp: {
    kind: 'custom'
    name: string
    type: Date
    opts: { decode: (input: unknown) => Date; encode: (input: Date) => unknown; is: (input: unknown) => boolean }
  }
} = {
  timestamp: {
    kind: 'custom',
    name: 'DateTime',
    opts: {
      decode: (input) => {
        if (typeof input === 'number') {
          return new Date(input)
        }
        throw 'Invalid'
      },
      encode: (input) => {
        return input.getTime()
      },
      is(input) {
        return input instanceof Date
      },
    },
    type: null as unknown as Date,
  },
}

export function typecheck(type: LazyType, value: unknown): boolean {
  const t = typeof type === 'function' ? type() : type
  if (t.kind === 'string') {
    if (typeof value !== 'string') return false
    if (t.opts?.maxLength && value.length > t.opts.maxLength) return false
    if (t.opts?.minLength && value.length < t.opts.minLength) return false
    if (t.opts?.regex && !t.opts.regex.test(value)) return false
  } else if (t.kind === 'optional-decorator') {
    if (value !== undefined && !typecheck(t.type, value)) return false
  } else if (t.kind === 'null') {
    if (value !== null) return false
  } else if (t.kind === 'union') {
    if (t.types.every((u) => !typecheck(u, value))) return false
  } else if (t.kind === 'object') {
    if (typeof value !== 'object') return false
    if (!value) return false
    for (const [key, subtype] of Object.entries(t.type)) {
      if (!typecheck(subtype, (value as Record<string, unknown>)[key])) return false
    }
  } else if (t.kind === 'array-decorator') {
    if (!Array.isArray(value)) return false
    if (value.some((e) => !typecheck(t.type, e))) return false
  }
  return true
}
