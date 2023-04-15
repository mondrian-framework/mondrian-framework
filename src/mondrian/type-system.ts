import { Expand, assertNever } from './utils'

export type StringType = { kind: 'string'; opts?: { maxLength?: number; regex?: RegExp; minLength?: number } }
export type CustomType = {
  kind: 'custom'
  type: unknown
  name: string
  opts: {
    decode: (input: unknown) => DecodeResult<unknown>
    encode: (input: any) => unknown
    is: (input: unknown) => boolean
  }
}
export type ObjectType = { kind: 'object'; type: { [K in string]: LazyType }; opts?: { strict?: boolean } }
export type Type =
  | ObjectType
  | { kind: 'number' }
  | StringType
  | { kind: 'literal'; values: readonly string[] }
  | { kind: 'boolean' }
  | { kind: 'array-decorator'; type: LazyType }
  | { kind: 'optional-decorator'; type: LazyType }
  | { kind: 'union'; types: LazyType[] }
  | CustomType

export type LazyType = Type | (() => Type)
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
    ? ST extends ObjectType['type']
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

type OptionalKeys<T extends ObjectType['type']> = {
  [K in keyof T]: T[K] extends { kind: 'optional-decorator'; type: unknown } ? K : never
}[keyof T]
type NonOptionalKeys<T extends ObjectType['type']> = {
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
export function object<const T extends ObjectType['type']>(
  type: T,
  opts?: ObjectType['opts'],
): Omit<ObjectType, 'type'> & { type: T } {
  return { kind: 'object', type, opts }
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
  opts: { decode: (input: unknown) => DecodeResult<T>; encode: (input: T) => unknown; is: (input: unknown) => boolean }
}): {
  kind: 'custom'
  name: string
  type: T
  opts: { decode: (input: unknown) => DecodeResult<T>; encode: (input: T) => unknown; is: (input: unknown) => boolean }
} {
  return { kind: 'custom', name, opts, type: null as T }
}

export const scalars: {
  null: {
    kind: 'custom'
    name: string
    type: null
    opts: {
      decode: (input: unknown) => DecodeResult<null>
      encode: (input: null) => unknown
      is: (input: unknown) => boolean
    }
  }
  unknown: {
    kind: 'custom'
    name: string
    type: unknown
    opts: {
      decode: (input: unknown) => DecodeResult<unknown>
      encode: (input: unknown) => unknown
      is: (input: unknown) => boolean
    }
  }
  timestamp: {
    kind: 'custom'
    name: string
    type: Date
    opts: {
      decode: (input: unknown) => DecodeResult<Date>
      encode: (input: Date) => unknown
      is: (input: unknown) => boolean
    }
  }
} = {
  timestamp: {
    kind: 'custom',
    name: 'Timestamp',
    opts: {
      decode: (input) => {
        if (typeof input !== 'number') {
          return { pass: false, errors: [{ path: '', value: input, error: 'Unix time expected (ms)' }] }
        }
        return { pass: true, value: new Date(input) }
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
  unknown: {
    kind: 'custom',
    name: 'Unknown',
    opts: {
      decode: (input) => ({ pass: true, value: input }),
      encode: (input) => input,
      is: () => true,
    },
    type: null,
  },
  null: {
    kind: 'custom',
    name: 'Null',
    opts: {
      decode: (input) => {
        if (input !== null) {
          return { pass: false, errors: [{ path: '', value: input, error: 'Null expected' }] }
        }
        return { pass: true, value: input }
      },
      encode: (input) => input,
      is: (input) => input === null,
    },
    type: null,
  },
}

export function parse<const T extends LazyType>(type: T, value: unknown): DecodeResult<InferType<T>> {
  const result = parseInternal(type, value, '.')
  return result as DecodeResult<InferType<T>>
}
type DecodeResult<T> =
  | { pass: true; value: T }
  | { pass: false; errors: { path: string; error: string; value: unknown }[] }
function parseInternal(type: unknown, value: unknown, path: string): DecodeResult<unknown> {
  const t = (typeof type === 'function' ? type() : type) as Type
  if (t.kind === 'string') {
    if (typeof value !== 'string') {
      return { pass: false, errors: [{ path, error: `String expected`, value }] }
    }
    if (t.opts?.maxLength && value.length > t.opts.maxLength) {
      return {
        pass: false,
        errors: [{ path, error: `String longer than max length (${value.length}/${t.opts.maxLength})`, value }],
      }
    }
    if (t.opts?.minLength && value.length < t.opts.minLength) {
      return {
        pass: false,
        errors: [{ path, error: `String shorter than min length (${value.length}/${t.opts.minLength})`, value }],
      }
    }
    if (t.opts?.regex && !t.opts.regex.test(value)) {
      return { pass: false, errors: [{ path, error: `String regex mismatch (${t.opts.regex.source})`, value }] }
    }
    return { pass: true, value }
  } else if (t.kind === 'number') {
    if (typeof value !== 'number') {
      return { pass: false, errors: [{ path, error: `Number expected`, value }] }
    }
    return { pass: true, value }
  } else if (t.kind === 'boolean') {
    if (typeof value !== 'boolean') {
      return { pass: false, errors: [{ path, error: `Boolean expected`, value }] }
    }
    return { pass: true, value }
  } else if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return { pass: true, value }
    }
    const result = parseInternal(t.type, value, path)
    if (!result.pass) {
      return { pass: false, errors: [...result.errors, { path, error: `Undefined expected`, value }] }
    }
    return { pass: true, value: result.value as any }
  } else if (t.kind === 'union') {
    const errors: { path: string; error: string; value: unknown }[] = []
    for (const u of t.types) {
      const result = parseInternal(u, value, path)
      if (result.pass) {
        return result
      }
      errors.push(...result.errors)
    }
    return { pass: false, errors }
  } else if (t.kind === 'object') {
    if (typeof value !== 'object' || !value) {
      return { pass: false, errors: [{ path, error: `Object expected`, value }] }
    }
    const obj = value as Record<string, unknown>
    const ret: Record<string, unknown> = t.opts?.strict === false ? {} : { ...value }
    for (const [key, subtype] of Object.entries(t.type)) {
      const result = parseInternal(subtype, obj[key], `${path}${key}.`)
      if (!result.pass) {
        return result
      }
      ret[key] = result.value
    }
    return { pass: true, value: ret }
  } else if (t.kind === 'array-decorator') {
    if (!Array.isArray(value)) {
      return { pass: false, errors: [{ path, error: `Array expected`, value }] }
    }
    const values: unknown[] = []
    for (let i = 0; i < value.length; i++) {
      const result = parseInternal(t.type, value[i], `${path}${i}.`)
      if (!result.pass) {
        return result
      }
      values.push(result.value)
    }
    return { pass: true, value: values }
  } else if (t.kind === 'literal') {
    if (typeof value !== 'string' || !t.values.includes(value)) {
      return {
        pass: false,
        errors: [{ path, error: `Literal expected (${t.values.map((v) => `"${v}"`).join(' | ')})`, value }],
      }
    }
    return { pass: true, value }
  } else if (t.kind === 'custom') {
    if (!t.opts.is(value)) {
      const result = t.opts.decode(value)
      if (!result.pass) {
        return { pass: false, errors: result.errors.map((e) => ({ ...e, path: `${path}${e.path}` })) }
      }
      return result
    }
    return { pass: true, value }
  } else {
    assertNever(t)
  }
}
