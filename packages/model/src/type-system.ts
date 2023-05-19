import { Expand, JSONType } from '@mondrian/utils'
import { DecodeResult } from './decoder'

export type StringType = {
  kind: 'string'
  opts?: {
    maxLength?: number
    regex?: RegExp
    minLength?: number
    format?: 'password' | 'byte' | 'binary' | 'email' | 'uuid' | 'url' | 'ipv4'
    description?: string
  }
}
export type NumberType = {
  kind: 'number'
  opts?: {
    exclusiveMaximum?: number
    exclusiveMinimum?: number
    minimum?: number
    maximum?: number
    description?: string
  }
}
export type BooleanType = { kind: 'boolean'; opts?: { description?: string } }
export type EnumeratorType<V extends readonly [string, ...string[]] = readonly [string, ...string[]]> = {
  kind: 'enumerator'
  values: V
  opts?: { description?: string }
}
export type LiteralType = { kind: 'literal'; value: any; opts?: { description?: string } }
export type TimestampType = CustomType<Date, 'timestamp', { min?: Date; max?: Date }>
export type DatetimeType = CustomType<Date, 'datetime', { min?: Date; max?: Date }>
export type VoidType = CustomType<void, 'void', {}>
export type ObjectType = {
  kind: 'object'
  type: { [K in string]: LazyType }
  opts?: { strict?: boolean; description?: string }
}
export type ArrayDecorator = { kind: 'array-decorator'; type: LazyType; opts?: { maxItems?: number } }
export type OptionalDecorator = { kind: 'optional-decorator'; type: LazyType }
export type DefaultDecorator = { kind: 'default-decorator'; type: LazyType; opts: { default?: unknown } }
export type UnionOperator = {
  kind: 'union-operator'
  types: Types
  opts?: {
    is?: {
      [K in string]: (value: unknown) => boolean
    }
    discriminant?: string
    description?: string
  }
}
export type HideDecorator = { kind: 'hide-decorator'; type: LazyType }

export type Type =
  | NumberType
  | StringType
  | EnumeratorType
  | BooleanType
  | CustomType
  | LiteralType
  | ObjectType
  | ArrayDecorator
  | OptionalDecorator
  | DefaultDecorator
  | HideDecorator
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
  opts?: O & { description?: string }
}

export type LazyType = Type | (() => Type)
export type Types = Record<string, LazyType>

export function types<const TS extends Types>(types: TS): TS {
  return types
}

export type Project<F, T extends LazyType> = [T] extends [() => infer LT]
  ? ProjectInternal<F, LT>
  : ProjectInternal<F, T>
type ProjectInternal<F, T> = [T] extends [{ kind: 'array-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Project<F, ST>[]
    : never
  : [T] extends [{ kind: 'optional-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Project<F, ST> | undefined
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Project<F, ST>
    : never
  : [T] extends [{ kind: 'hide-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Project<F, ST>
    : never
  : [T] extends [{ kind: 'string' }]
  ? string
  : [T] extends [{ kind: 'number' }]
  ? number
  : [T] extends [{ kind: 'boolean' }]
  ? boolean
  : [T] extends [{ kind: 'literal'; value: infer ST }]
  ? ST
  : [T] extends [{ kind: 'custom'; type: infer C }]
  ? C
  : [T] extends [{ kind: 'enumerator'; values: infer V }]
  ? V extends readonly string[]
    ? V[number]
    : never
  : [T] extends [{ kind: 'union-operator'; types: infer TS }]
  ? TS extends Types
    ? F extends true
      ? InferTypeInternal<T, false, true>
      : { [K in keyof TS]: F extends Record<K, unknown> ? Project<F[K], TS[K]> : Project<{}, TS[K]> }[keyof TS]
    : never
  : [T] extends [{ kind: 'object'; type: infer ST }]
  ? ST extends ObjectType['type']
    ? F extends true
      ? InferTypeInternal<T, false, true>
      : Expand<
          {
            [K in NonOptionalKeys<ST> & keyof F]: Project<F[K], ST[K]>
          } & {
            [K in OptionalKeys<ST> & keyof F]?: Project<F[K], ST[K]>
          }
        >
    : never
  : unknown

export type Infer<T extends LazyType> = InferType<T, false, false>
export type InferReturn<T extends LazyType> = InferType<T, true, false>
type InferType<T extends LazyType, Partial extends boolean, Shader extends boolean> = [T] extends [() => infer LT]
  ? InferTypeInternal<LT, Partial, Shader>
  : InferTypeInternal<T, Partial, Shader>
type InferTypeInternal<T, Partial extends boolean, Shader extends boolean> = [T] extends [
  { kind: 'array-decorator'; type: infer ST },
]
  ? ST extends LazyType
    ? InferType<ST, Partial, Shader>[]
    : never
  : [T] extends [{ kind: 'optional-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferType<ST, Partial, Shader> | undefined
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferType<ST, Partial, Shader>
    : never
  : [T] extends [{ kind: 'hide-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Shader extends true
      ? undefined
      : InferType<ST, Partial, Shader>
    : never
  : [T] extends [{ kind: 'string' }]
  ? string
  : [T] extends [{ kind: 'number' }]
  ? number
  : [T] extends [{ kind: 'boolean' }]
  ? boolean
  : [T] extends [{ kind: 'literal'; value: infer ST }]
  ? ST
  : [T] extends [{ kind: 'custom'; type: infer C }]
  ? C
  : [T] extends [{ kind: 'enumerator'; values: infer V }]
  ? V extends readonly string[]
    ? V[number]
    : never
  : [T] extends [{ kind: 'union-operator'; types: infer TS }]
  ? TS extends Types
    ? { [K in keyof TS]: InferType<TS[K], Partial, Shader> }[keyof TS]
    : never
  : [T] extends [{ kind: 'object'; type: infer ST }]
  ? ST extends ObjectType['type']
    ? Partial extends true
      ? Expand<{
          [K in keyof ST]?: InferType<ST[K], Partial, Shader>
        }>
      : Expand<
          {
            [K in NonOptionalKeys<ST>]: InferType<ST[K], Partial, Shader>
          } & {
            [K in OptionalKeys<ST>]?: InferType<ST[K], Partial, Shader>
          }
        >
    : never
  : unknown

export type InferProjection<T extends LazyType> = [T] extends [() => infer LT]
  ? InferProjectionInternal<LT>
  : InferProjectionInternal<T>
type InferProjectionInternal<T> = [T] extends [{ kind: 'array-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferProjection<ST>
    : never
  : [T] extends [{ kind: 'optional-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferProjection<ST>
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferProjection<ST>
    : never
  : [T] extends [{ kind: 'hide-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferProjection<ST>
    : never
  : [T] extends [{ kind: 'object'; type: infer ST }]
  ? ST extends ObjectType['type']
    ?
        | Expand<{
            [K in keyof ST]?: InferProjection<ST[K]>
          }>
        | true
    : never
  : [T] extends [{ kind: 'union-operator'; types: infer TS }]
  ? TS extends Types
    ? { [K in keyof TS]?: InferProjection<TS[K]> } | true
    : never
  : true

type OptionalKeys<T extends ObjectType['type']> = {
  [K in keyof T]: HasOptionalDecorator<T[K]> extends true ? K : never
}[keyof T]
type NonOptionalKeys<T extends ObjectType['type']> = {
  [K in keyof T]: HasOptionalDecorator<T[K]> extends true ? never : K
}[keyof T]

type HasOptionalDecorator<T extends LazyType> = [T] extends [() => infer LT]
  ? LT extends Type
    ? HasOptionalDecorator<LT>
    : false
  : [T] extends [{ kind: 'optional-decorator'; type: unknown }]
  ? true
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? HasOptionalDecorator<ST>
    : false
  : [T] extends [{ kind: 'hide-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? HasOptionalDecorator<ST>
    : false
  : false

export function number(opts?: NumberType['opts']): NumberType {
  return { kind: 'number', opts }
}
export function string(opts?: StringType['opts']): StringType {
  return { kind: 'string', opts }
}
export function literal<const T extends number | string | boolean | null>(
  value: T,
  opts?: LiteralType['opts'],
): { kind: 'literal'; value: T; opts?: LiteralType['opts'] } {
  return { kind: 'literal', value, opts }
}
export function union<const T extends Types>(
  types: T,
  opts?: {
    is?: {
      [K in keyof T]: (value: Infer<T[keyof T]>) => boolean
    }
    discriminant?: keyof Infer<{ kind: 'union-operator'; types: T }>
  },
): { kind: 'union-operator'; types: T; opts: UnionOperator['opts'] } {
  /*function flattened() {
    const entries: [string, LazyType][] = Object.entries(types).flatMap(([k, type]) => {
      const t = lazyToType(type)
      if (t.kind === 'union-operator') {
        return Object.entries(t.types)
      }
      return [[k, type]]
    })
    return entries
  }
  if (Object.values(types).some((t) => typeof t === 'function')) {
    //If it has
    return (() => ({ kind: 'union-operator', types: Object.fromEntries(flattened()) as T })) as any
  } else {
    return { kind: 'union-operator', types: Object.fromEntries(flattened()) as T }
  }*/
  return { kind: 'union-operator', types, opts: opts as UnionOperator['opts'] }
}
export function enumerator<const V extends readonly [string, ...string[]]>(
  values: V,
  opts?: EnumeratorType<V>['opts'],
): EnumeratorType<V> {
  return { kind: 'enumerator', values, opts }
}
export function boolean(opts?: BooleanType['opts']): BooleanType {
  return { kind: 'boolean', opts }
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
export function nullable<const T extends LazyType>(
  type: T,
): { kind: 'union-operator'; types: { null: { kind: 'literal'; value: null }; other: T } } {
  return { kind: 'union-operator', types: { null: literal(null), other: type } }
}
export function preset<const T extends LazyType>(
  type: T,
  value: Infer<T>,
): { kind: 'default-decorator'; type: T; opts: { default: unknown } } {
  return { kind: 'default-decorator', type, opts: { default: value } }
}
export function hide<const T extends LazyType>(type: T): { kind: 'hide-decorator'; type: T } {
  return { kind: 'hide-decorator', type }
}

export function custom<const T, const N extends string>(
  custom: Omit<CustomType<T, N>, 'kind' | 'type' | 'opts'>,
  opts?: CustomType<T, N>['opts'],
): CustomType<T, N> {
  return { ...custom, kind: 'custom', type: null as T, opts }
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

export function nothing(opts?: VoidType['opts']): VoidType {
  return {
    kind: 'custom',
    name: 'void',
    decode: (input) => {
      return { pass: true, value: input as void }
    },
    encode: (input) => {
      return null
    },
    is() {
      return true
    },
    opts,
    type: null as unknown as void,
  }
}

type Selection<T extends ObjectType, P extends Partial<Record<keyof T['type'], true>>> = {
  kind: 'object'
  type: { [K in keyof T['type'] & keyof P]: T['type'][K] }
  opts: ObjectType['opts']
}
export function select<const T extends ObjectType, const P extends Partial<Record<keyof T['type'], true>>>(
  t: T,
  selection: P,
  opts?: ObjectType['opts'],
): Selection<T, P> {
  return {
    kind: 'object',
    type: Object.fromEntries(Object.entries(t.type).filter((v) => selection[v[0]])),
    opts,
  } as Selection<T, P>
}

type Merge<T1 extends ObjectType, T2 extends ObjectType> = {
  kind: 'object'
  type: { [K in Exclude<keyof T1['type'], keyof T2['type']>]: T1['type'][K] } & {
    [K in keyof T2['type']]: T2['type'][K]
  }
  opts: ObjectType['opts']
}
export function merge<const T1 extends ObjectType, const T2 extends ObjectType>(
  t1: T1,
  t2: T2,
  opts?: ObjectType['opts'],
): Merge<T1, T2> {
  const t1e = Object.entries(t1)
  const t2e = Object.entries(t2)
  return {
    kind: 'object',
    type: Object.fromEntries([...t1e.filter((v1) => !t2e.some((v2) => v1[0] !== v2[0])), ...t2e]),
    opts,
  } as Merge<T1, T2>
}
