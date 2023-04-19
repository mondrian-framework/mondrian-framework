import { Expand, JSONType, assertNever, lazyToType } from './utils'

export type StringType = { kind: 'string'; opts?: { maxLength?: number; regex?: RegExp; minLength?: number } }
export type NumberType = { kind: 'number'; opts?: {} }
export type BooleanType = { kind: 'boolean'; opts?: {} }
export type EnumeratorType<V extends readonly [string, ...string[]] = readonly [string, ...string[]]> = {
  kind: 'enumarator'
  values: V
}
export type NullType = { kind: 'null' }
export type TimestampType = CustomType<Date, 'timestamp', { min?: Date; max?: Date }>
export type DatetimeType = CustomType<Date, 'datetime', { min?: Date; max?: Date }>
export type ObjectType = {
  kind: 'object'
  type: { [K in string]: LazyType }
  opts?: { strict?: boolean }
}
export type ArrayDecorator = { kind: 'array-decorator'; type: LazyType }
export type OptionalDecorator = { kind: 'optional-decorator'; type: LazyType }
export type UnionOperator = { kind: 'union-operator'; types: LazyType[] }
export type Type =
  | NumberType
  | StringType
  | EnumeratorType
  | BooleanType
  | NullType
  | CustomType
  | ObjectType
  | ArrayDecorator
  | OptionalDecorator
  | UnionOperator

export type CustomType<
  T = any,
  N extends string = string,
  O extends Record<string, unknown> = Record<never, unknown>,
> = {
  kind: 'custom'
  type: T
  name: N
  decode: (input: unknown, context: O | undefined) => DecodeResult<T>
  encode: (input: T, context: O | undefined) => JSONType
  is: (input: unknown, context: O | undefined) => boolean
  opts?: O
}

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
    : T extends { kind: 'null' }
    ? null
    : T extends { kind: 'custom'; type: infer C }
    ? C
    : T extends { kind: 'enumarator'; values: infer V }
    ? V extends readonly string[]
      ? V[number]
      : never
    : T extends { kind: 'union-operator'; types: infer TS }
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

export function number(): { kind: 'number' } {
  return { kind: 'number' }
}
export function string(opts?: StringType['opts']): StringType {
  return { kind: 'string', opts }
}
export function union<const T1 extends LazyType, const T2 extends LazyType, const TS extends LazyType[]>(
  types: [T1, T2, ...TS],
): { kind: 'union-operator'; types: [T1, T2, ...TS] } {
  return { kind: 'union-operator', types }
}
export function enumarator<const V extends readonly [string, ...string[]]>(values: V): EnumeratorType<V> {
  return { kind: 'enumarator', values }
}
export function boolean(): BooleanType {
  return { kind: 'boolean' }
}
export function nill(): NullType {
  return { kind: 'null' }
}
export function object<const T extends ObjectType['type']>(
  type: T,
  opts?: ObjectType['opts'],
): Omit<ObjectType, 'type'> & { type: T } {
  return { kind: 'object', type, opts }
}
export function array<const T extends LazyType>(type: T): { kind: 'array-decorator'; type: T } {
  return { kind: 'array-decorator', type }
}
export function optional<const T extends LazyType>(type: T): { kind: 'optional-decorator'; type: T } {
  return { kind: 'optional-decorator', type }
}
export function custom<const T, const N extends string>(
  custom: Omit<CustomType<T, N>, 'kind' | 'type' | 'opts'>,
): CustomType<T, N> {
  return { ...custom, kind: 'custom', type: null as T }
}
export function timestamp(opts?: TimestampType['opts']): TimestampType {
  return {
    kind: 'custom',
    name: 'timestamp',
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
    opts,
    type: null as unknown as Date,
  }
}

export function datetime(opts?: DatetimeType['opts']): DatetimeType {
  return {
    kind: 'custom',
    name: 'datetime',
    decode: (input) => {
      const time = Date.parse(typeof input === 'string' ? input : '')
      if (Number.isNaN(time)) {
        return { pass: false, errors: [{ path: '', value: input, error: 'ISO date expected' }] }
      }
      return { pass: true, value: new Date(time) }
    },
    encode: (input) => {
      return input.toISOString()
    },
    is(input) {
      return input instanceof Date
    },
    opts,
    type: null as unknown as Date,
  }
}

export function encode<const T extends LazyType>(type: T, value: Infer<T>): JSONType {
  //@ts-ignore
  return encodeInternal(type, value)
}
export function encodeInternal(type: LazyType, value: JSONType): JSONType {
  const t = lazyToType(type)
  if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return undefined
    }
    return encode(t.type, value)
  }
  if (t.kind === 'array-decorator') {
    const results = []
    for (const v of value as Array<unknown>) {
      results.push(encode(t.type, v))
    }
    return results
  }
  if (t.kind === 'object') {
    const ret: { [K in string]: JSONType } = {}
    for (const [key, v] of Object.entries(value as object)) {
      ret[key] = encode(t.type[key], v)
    }
    return ret
  }
  if (t.kind === 'custom') {
    return t.encode(value, t.opts)
  }
  if (t.kind === 'union-operator') {
    for (const subtype of t.types) {
      if (decode(subtype, value).pass) {
        return encode(subtype, value)
      }
    }
    assertNever(t as never)
  }
  if (
    t.kind === 'boolean' ||
    t.kind === 'enumarator' ||
    t.kind === 'null' ||
    t.kind === 'number' ||
    t.kind === 'string'
  ) {
    return value
  }
  assertNever(t)
}
export function decode<const T extends LazyType>(type: T, value: unknown): DecodeResult<InferType<T>> {
  const result = decodeInternal(type, value, '/')
  return result as DecodeResult<InferType<T>>
}
type DecodeResult<T> =
  | { pass: true; value: T }
  | { pass: false; errors: { path: string; error: string; value: unknown }[] }

export function decodeInternal(type: LazyType, value: unknown, path: string): DecodeResult<unknown> {
  const t = lazyToType(type)
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
  } else if (t.kind === 'null') {
    if (value !== null) {
      return { pass: false, errors: [{ path, error: `Null expected`, value }] }
    }
    return { pass: true, value }
  } else if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return { pass: true, value }
    }
    const result = decodeInternal(t.type, value, path)
    if (!result.pass) {
      return { pass: false, errors: [...result.errors, { path, error: `Undefined expected`, value }] }
    }
    return { pass: true, value: result.value as any }
  } else if (t.kind === 'union-operator') {
    const errors: { path: string; error: string; value: unknown }[] = []
    for (const u of t.types) {
      const result = decodeInternal(u, value, path)
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
      const result = decodeInternal(subtype, obj[key], `${path}${key}/`)
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
      const result = decodeInternal(t.type, value[i], `${path}${i}/`)
      if (!result.pass) {
        return result
      }
      values.push(result.value)
    }
    return { pass: true, value: values }
  } else if (t.kind === 'enumarator') {
    if (typeof value !== 'string' || !t.values.includes(value)) {
      return {
        pass: false,
        errors: [{ path, error: `enumarator expected (${t.values.map((v) => `"${v}"`).join(' | ')})`, value }],
      }
    }
    return { pass: true, value }
  } else if (t.kind === 'custom') {
    if (!t.is(value, t.opts)) {
      const result = t.decode(value, t.opts)
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
