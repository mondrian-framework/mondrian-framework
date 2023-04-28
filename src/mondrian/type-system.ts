import { DecodeResult, decode } from './decoder'
import { Expand, JSONType, assertNever, lazyToType } from './utils'

export type StringType = { kind: 'string'; opts?: { maxLength?: number; regex?: RegExp; minLength?: number } }
export type NumberType = {
  kind: 'number'
  opts?: { exclusiveMaximum?: number; exclusiveMinimum?: number; minimum?: number; maximum?: number }
}
export type BooleanType = { kind: 'boolean'; opts?: {} }
export type EnumeratorType<V extends readonly [string, ...string[]] = readonly [string, ...string[]]> = {
  kind: 'enumerator'
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
export type ArrayDecorator = { kind: 'array-decorator'; type: LazyType; opts?: { maxItems?: number } }
export type OptionalDecorator = { kind: 'optional-decorator'; type: LazyType }
export type DefaultDecorator = { kind: 'default-decorator'; type: LazyType; opts: { default?: unknown } }
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
  | DefaultDecorator
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

export type Infer<T extends LazyType> = [T] extends [() => infer LT] ? InferType<LT> : InferType<T>
export type InferReturn<T extends LazyType> = [T] extends [() => infer LT] ? InferReturnType<LT> : InferReturnType<T>

type InferUnionType<TS extends LazyType[]> = TS extends [infer H, ...infer T]
  ? H extends LazyType
    ? T extends LazyType[]
      ? Infer<H> | InferUnionType<T>
      : never
    : never
  : never

type InferType<T> = [T] extends [{ kind: 'array-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Infer<ST>[]
    : never
  : [T] extends [{ kind: 'optional-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Infer<ST> | undefined
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Infer<ST>
    : never
  : [T] extends [{ kind: 'string' }]
  ? string
  : [T] extends [{ kind: 'number' }]
  ? number
  : [T] extends [{ kind: 'boolean' }]
  ? boolean
  : [T] extends [{ kind: 'null' }]
  ? null
  : [T] extends [{ kind: 'custom'; type: infer C }]
  ? C
  : [T] extends [{ kind: 'enumerator'; values: infer V }]
  ? V extends readonly string[]
    ? V[number]
    : never
  : [T] extends [{ kind: 'union-operator'; types: infer TS }]
  ? TS extends Array<any>
    ? InferUnionType<TS>
    : never
  : [T] extends [{ kind: 'object'; type: infer ST }]
  ? ST extends ObjectType['type']
    ? Expand<
        {
          [K in NonOptionalKeys<ST>]: Infer<ST[K]>
        } & {
          [K in OptionalKeys<ST>]?: Infer<ST[K]>
        }
      >
    : never
  : unknown

type InferReturnType<T> = [T] extends [{ kind: 'array-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Infer<ST>[]
    : never
  : [T] extends [{ kind: 'optional-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Infer<ST> | undefined
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Infer<ST>
    : never
  : [T] extends [{ kind: 'string' }]
  ? string
  : [T] extends [{ kind: 'number' }]
  ? number
  : [T] extends [{ kind: 'boolean' }]
  ? boolean
  : [T] extends [{ kind: 'null' }]
  ? null
  : [T] extends [{ kind: 'custom'; type: infer C }]
  ? C
  : [T] extends [{ kind: 'enumerator'; values: infer V }]
  ? V extends readonly string[]
    ? V[number]
    : never
  : [T] extends [{ kind: 'union-operator'; types: infer TS }]
  ? TS extends Array<any>
    ? Infer<TS[number]>
    : never
  : [T] extends [{ kind: 'object'; type: infer ST }]
  ? ST extends ObjectType['type']
    ? Expand<{
        [K in keyof ST]?: InferReturn<ST[K]>
      }>
    : never
  : unknown

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

export function number(opts?: NumberType['opts']): NumberType {
  return { kind: 'number', opts }
}
export function string(opts?: StringType['opts']): StringType {
  return { kind: 'string', opts }
}
export function union<const T1 extends LazyType, const T2 extends LazyType, const TS extends LazyType[]>(
  types: [T1, T2, ...TS],
): { kind: 'union-operator'; types: [T1, T2, ...TS] } {
  return { kind: 'union-operator', types }
}
export function enumerator<const V extends readonly [string, ...string[]]>(values: V): EnumeratorType<V> {
  return { kind: 'enumerator', values }
}
export function boolean(): BooleanType {
  return { kind: 'boolean' }
}
export function nullable<const T extends LazyType>(type: T): { kind: 'union-operator'; types: [T, { kind: 'null' }] } {
  return { kind: 'union-operator', types: [type, { kind: 'null' }] }
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
export function array<const T extends LazyType>(
  type: T,
  opts?: ArrayDecorator['opts'],
): { kind: 'array-decorator'; type: T; opts: ArrayDecorator['opts'] } {
  return { kind: 'array-decorator', type, opts }
}
export function optional<const T extends LazyType>(type: T): { kind: 'optional-decorator'; type: T } {
  return { kind: 'optional-decorator', type }
}
export function defaul<const T extends LazyType>(
  type: T,
  value: Infer<T>,
): { kind: 'default-decorator'; type: T; opts: { default: unknown } } {
  return { kind: 'default-decorator', type, opts: { default: value } }
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

export function envs<const T extends ObjectType['type']>(properties: T): Infer<{ kind: 'object'; type: T }> {
  const obj: Record<string, unknown> = {}
  for (const key of Object.keys(properties)) {
    obj[key] = process.env[key]
  }
  const result = decode({ kind: 'object', type: properties }, obj, { cast: true })
  if (!result.pass) {
    throw new Error(`Invalid envs: ${JSON.stringify(result.errors)}`)
  }
  return result.value as any
}
