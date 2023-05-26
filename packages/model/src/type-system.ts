import { Expand, JSONType } from '@mondrian-framework/utils'
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
    multipleOf?: number
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
export type NullableDecorator = { kind: 'nullable-decorator'; type: LazyType }
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
export type RelationDecorator = { kind: 'relation-decorator'; type: LazyType }

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
  | NullableDecorator
  | DefaultDecorator
  | RelationDecorator
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
  : [T] extends [{ kind: 'nullable-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Project<F, ST> | null
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? Project<F, ST>
    : never
  : [T] extends [{ kind: 'relation-decorator'; type: infer ST }]
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
  : [T] extends [{ kind: 'nullable-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferType<ST, Partial, Shader> | null
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferType<ST, Partial, Shader>
    : never
  : [T] extends [{ kind: 'relation-decorator'; type: infer ST }]
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
  : [T] extends [{ kind: 'nullable-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferProjection<ST>
    : never
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? InferProjection<ST>
    : never
  : [T] extends [{ kind: 'relation-decorator'; type: infer ST }]
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
  : [T] extends [{ kind: 'nullable-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? HasOptionalDecorator<ST>
    : false
  : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? HasOptionalDecorator<ST>
    : false
  : [T] extends [{ kind: 'relation-decorator'; type: infer ST }]
  ? ST extends LazyType
    ? HasOptionalDecorator<ST>
    : false
  : false

export type DecoratorShorcuts<
  T extends LazyType,
  O extends 'optional' | 'nullable' | 'array' | 'default' = never,
> = Omit<
  {
    optional(): { kind: 'optional-decorator'; type: T } & DecoratorShorcuts<
      { kind: 'optional-decorator'; type: T },
      O | 'optional'
    >
    default(
      value: [T] extends [LazyType] ? Infer<T> : never,
    ): { kind: 'default-decorator'; type: T; opts: DefaultDecorator['opts'] } & DecoratorShorcuts<
      { kind: 'default-decorator'; type: T; opts: DefaultDecorator['opts'] },
      O | 'default' | 'optional'
    >
    nullable(): { kind: 'nullable-decorator'; type: T } & DecoratorShorcuts<
      { kind: 'nullable-decorator'; type: T },
      O | 'nullable'
    >
    array(
      opts?: ArrayDecorator['opts'],
    ): { kind: 'array-decorator'; type: T } & DecoratorShorcuts<
      { kind: 'array-decorator'; type: T },
      Exclude<O, 'optional' | 'nullable'>
    >
  },
  O
>

function decoratorShorcut<T extends LazyType>(t: T): DecoratorShorcuts<T> {
  //@ts-ignore
  return {
    array: (opts) => array(t, opts),
    optional: () => optional(t),
    nullable: () => nullable(t),
    default: (value) => preset(t, value),
  }
}

export function number(opts?: NumberType['opts']): NumberType & DecoratorShorcuts<NumberType> {
  if (opts?.multipleOf && opts.multipleOf <= 0) {
    throw new Error('Invalid multipleOf for integer (must be > 0)')
  }
  const t = { kind: 'number', opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function integer(opts?: NumberType['opts']): NumberType & DecoratorShorcuts<NumberType> {
  if (opts?.multipleOf && opts.multipleOf % 1 !== 0) {
    throw new Error('Invalid multipleOf for integer (must be integer)')
  }
  return number({ multipleOf: 1, ...opts })
}

export function string(opts?: StringType['opts']): StringType & DecoratorShorcuts<StringType> {
  const t = { kind: 'string', opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function email(opts?: StringType['opts']): StringType & DecoratorShorcuts<StringType> {
  const t = { kind: 'string', opts: { ...opts, format: 'email' } } as const
  return { ...t, ...decoratorShorcut(t) }
}

export function nill(opts?: StringType['opts']): {
  kind: 'literal'
  value: null
  opts?: LiteralType['opts']
} & DecoratorShorcuts<{
  kind: 'literal'
  value: null
  opts?: LiteralType['opts']
}> {
  const t = literal(null)
  return { ...t, ...decoratorShorcut(t) }
}
export function literal<const T extends number | string | boolean | null>(
  value: T,
  opts?: LiteralType['opts'],
): { kind: 'literal'; value: T; opts?: LiteralType['opts'] } & DecoratorShorcuts<{
  kind: 'literal'
  value: T
  opts?: LiteralType['opts']
}> {
  const t = { kind: 'literal', value, opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function union<const T extends Types>(
  types: T,
  opts?: {
    is?: {
      [K in keyof T]: (value: Infer<T[keyof T]>) => boolean
    }
    discriminant?: keyof Infer<{ kind: 'union-operator'; types: T }>
  },
): { kind: 'union-operator'; types: T; opts: UnionOperator['opts'] } & DecoratorShorcuts<{
  kind: 'union-operator'
  types: T
  opts: UnionOperator['opts']
}> {
  const t = { kind: 'union-operator', types, opts: opts as UnionOperator['opts'] } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function enumerator<const V extends readonly [string, ...string[]]>(
  values: V,
  opts?: EnumeratorType<V>['opts'],
): EnumeratorType<V> & DecoratorShorcuts<EnumeratorType<V>> {
  const t = { kind: 'enumerator', values, opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function boolean(opts?: BooleanType['opts']): BooleanType & DecoratorShorcuts<BooleanType> {
  const t = { kind: 'boolean', opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function object<const T extends ObjectType['type']>(
  type: T,
  opts?: ObjectType['opts'],
): { kind: 'object'; type: T; opts?: ObjectType['opts'] } & DecoratorShorcuts<{
  kind: 'object'
  type: T
  opts?: ObjectType['opts']
}> {
  const t = { kind: 'object', type, opts } as const
  return { ...t, ...decoratorShorcut(t) }
}

export function array<const T extends LazyType>(
  type: T,
  opts?: ArrayDecorator['opts'],
): { kind: 'array-decorator'; type: T; opts: ArrayDecorator['opts'] } & DecoratorShorcuts<{
  kind: 'array-decorator'
  type: T
  opts: ArrayDecorator['opts']
}> {
  const t = { kind: 'array-decorator', type, opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function optional<const T extends LazyType>(
  type: T,
): { kind: 'optional-decorator'; type: T } & DecoratorShorcuts<{ kind: 'optional-decorator'; type: T }, 'optional'> {
  const t = { kind: 'optional-decorator', type } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function nullable<const T extends LazyType>(
  type: T,
): { kind: 'nullable-decorator'; type: T } & DecoratorShorcuts<{ kind: 'nullable-decorator'; type: T }, 'nullable'> {
  const t = { kind: 'nullable-decorator', type } as const
  return { ...t, ...decoratorShorcut(t) }
}

export function preset<const T extends LazyType>(
  type: T,
  value: Infer<T>,
): { kind: 'default-decorator'; type: T; opts: { default: unknown } } & DecoratorShorcuts<{
  kind: 'default-decorator'
  type: T
  opts: { default: unknown }
}> {
  const t = { kind: 'default-decorator', type, opts: { default: value } } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function relation<const T extends LazyType>(type: T): { kind: 'relation-decorator'; type: T } {
  return { kind: 'relation-decorator', type } as const
}

export function custom<const T, const N extends string>(
  custom: Omit<CustomType<T, N>, 'kind' | 'type' | 'opts'>,
  opts?: CustomType<T, N>['opts'],
): CustomType<T, N> & DecoratorShorcuts<CustomType<T, N>> {
  const t = { ...custom, kind: 'custom', type: null as T, opts } as const
  return { ...t, ...decoratorShorcut(t) }
}
export function timestamp(opts?: TimestampType['opts']): TimestampType & DecoratorShorcuts<TimestampType> {
  const t: TimestampType = {
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
  return { ...t, ...decoratorShorcut(t) }
}

export function datetime(opts?: DatetimeType['opts']): DatetimeType & DecoratorShorcuts<DatetimeType> {
  const t: DatetimeType = {
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
  return { ...t, ...decoratorShorcut(t) }
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

type Selection<
  T extends ObjectType | (() => ObjectType),
  P extends Partial<Record<LazyToType<T> extends ObjectType ? keyof LazyToType<T>['type'] : never, true>>,
> = [T] extends [ObjectType]
  ? SelectionInternal<T, P> & DecoratorShorcuts<SelectionInternal<T, P>>
  : () => SelectionInternal<T, P> & DecoratorShorcuts<SelectionInternal<T, P>>
type SelectionInternal<
  T extends ObjectType | (() => ObjectType),
  P extends Partial<Record<LazyToType<T> extends ObjectType ? keyof LazyToType<T>['type'] : never, true>>,
> = LazyToType<T> extends ObjectType
  ? {
      kind: 'object'
      type: { [K in keyof LazyToType<T>['type'] & keyof P]: LazyToType<T>['type'][K] }
      opts: ObjectType['opts']
    }
  : never
type LazyToType<T extends LazyType> = [T] extends [() => infer R]
  ? [R] extends [Type]
    ? R
    : never
  : [T] extends [Type]
  ? T
  : never
export function select<
  const T extends ObjectType | (() => ObjectType),
  const P extends Partial<Record<LazyToType<T> extends ObjectType ? keyof LazyToType<T>['type'] : never, true>>,
>(type: T, selection: P, opts?: ObjectType['opts']): Selection<T, P> {
  if (typeof type === 'function') {
    return (() => select(type(), selection, opts)) as unknown as Selection<T, P>
  }
  const t = {
    kind: 'object',
    type: Object.fromEntries(Object.entries(type.type).filter((v) => (selection as Record<string, boolean>)[v[0]])),
    opts,
  } as Selection<T, P>
  return { ...t, ...decoratorShorcut(t) } as Selection<T, P> & DecoratorShorcuts<Selection<T, P>>
}

type Merge<T1 extends ObjectType | (() => ObjectType), T2 extends ObjectType | (() => ObjectType)> = [T1] extends [
  ObjectType,
]
  ? [T2] extends [ObjectType]
    ? MergeInternal<T1, T2> & DecoratorShorcuts<MergeInternal<T1, T2>>
    : LazyToType<T2> extends ObjectType
    ? () => MergeInternal<T1, LazyToType<T2>>
    : never
  : [T2] extends [ObjectType]
  ? LazyToType<T1> extends ObjectType
    ? () => MergeInternal<LazyToType<T1>, T2>
    : never
  : LazyToType<T1> extends ObjectType
  ? LazyToType<T2> extends ObjectType
    ? () => MergeInternal<LazyToType<T1>, LazyToType<T2>>
    : never
  : never

type MergeInternal<T1 extends ObjectType, T2 extends ObjectType> = {
  kind: 'object'
  type: { [K in Exclude<keyof T1['type'], keyof T2['type']>]: T1['type'][K] } & {
    [K in keyof T2['type']]: T2['type'][K]
  }
  opts: ObjectType['opts']
}

export function merge<
  const T1 extends ObjectType | (() => ObjectType),
  const T2 extends ObjectType | (() => ObjectType),
>(t1: T1, t2: T2, opts?: ObjectType['opts']): Merge<T1, T2> {
  function internal(t1: ObjectType, t2: ObjectType) {
    const t1e = Object.entries(t1.type)
    const t2e = Object.entries(t2.type)
    const result = {
      kind: 'object',
      type: Object.fromEntries([...t1e.filter((v1) => !t2e.some((v2) => v1[0] === v2[0])), ...t2e]),
      opts,
    } as Merge<T1, T2>
    return result
  }
  if (typeof t1 === 'function' || typeof t2 === 'function') {
    return (() => {
      return internal(typeof t1 === 'function' ? t1() : t1, typeof t2 === 'function' ? t2() : t2)
    }) as unknown as Merge<T1, T2>
  }
  const t = internal(t1, t2)
  return { ...t, ...decoratorShorcut(t) }
}
