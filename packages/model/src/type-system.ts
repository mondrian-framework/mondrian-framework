import { DecodeOptions } from './decoder'
import { DecoratorShorcuts, decoratorShorcuts } from './decorator-shortcut'
import { GenericProjection } from './projection'
import { Failure, Result } from './result'
import { lazyToType } from './utils'
import { Expand } from '@mondrian-framework/utils'

export interface Type {}
export type LazyType = Type | (() => Type)

export type Types = Record<string, LazyType>

export interface StringType extends Type {
  kind: 'string'
  opts?: {
    maxLength?: number
    regex?: RegExp
    minLength?: number
    description?: string
  }
}
export interface NumberType extends Type {
  kind: 'number'
  opts?: {
    exclusiveMaximum?: number
    exclusiveMinimum?: number
    minimum?: number
    maximum?: number
    multipleOf?: number
    description?: string
  }
}
export interface BooleanType extends Type {
  kind: 'boolean'
  opts?: { description?: string }
}
export interface EnumType<V extends readonly [string, ...string[]] = readonly [string, ...string[]]> extends Type {
  kind: 'enum'
  values: V
  opts?: { description?: string }
}
export interface LiteralType<T extends number | string | boolean | null = null> extends Type {
  kind: 'literal'
  value: T
  opts?: { description?: string }
}
export interface ObjectType<TS extends Types = Types> extends Type {
  kind: 'object'
  type: TS
  opts?: { description?: string }
}
export interface ArrayDecorator<T extends LazyType = Type> extends Type {
  kind: 'array-decorator'
  type: T
  opts?: { maxItems?: number }
}
export interface OptionalDecorator<T extends LazyType = Type> extends Type {
  kind: 'optional-decorator'
  type: T
}
export interface NullableDecorator<T extends LazyType = Type> extends Type {
  kind: 'nullable-decorator'
  type: T
}
export interface DefaultDecorator<T extends LazyType = Type> extends Type {
  kind: 'default-decorator'
  type: T
  opts: { default?: Infer<T> | (() => Infer<T>) }
}
export interface RelationDecorator<T extends LazyType = Type> extends Type {
  kind: 'relation-decorator'
  type: T
}
export interface UnionOperator<
  TS extends Types = Types,
  P extends InferProjection<{ kind: 'union-operator'; types: TS }> | boolean = false,
> extends Type {
  kind: 'union-operator'
  types: TS
  opts?: {
    is?: {
      [K in keyof TS]: (value: Project<P, { kind: 'union-operator'; types: TS }>) => boolean
    }
    requiredProjection?: P
    description?: string
  }
}

export type AnyType =
  | NumberType
  | StringType
  | EnumType
  | BooleanType
  | RootCustomType
  | LiteralType
  | ObjectType
  | ArrayDecorator
  | OptionalDecorator
  | NullableDecorator
  | DefaultDecorator
  | RelationDecorator
  | UnionOperator

export type CustomTypeOpts = { description?: string }

export type CustomType<
  T = any,
  E extends LazyType = Type,
  O extends Record<string, unknown> = Record<never, unknown>,
> = RootCustomType<T, E, O> & DecoratorShorcuts<RootCustomType<T, E, O>>

export interface RootCustomType<T = any, E extends LazyType = Type, O = any> extends Type {
  kind: 'custom'
  type: T
  name: string
  format?: string
  encodedType: E
  decode: (input: Infer<E>, options: O | undefined, decodeOptions: DecodeOptions | undefined) => Result<T>
  encode: (input: T, options: O | undefined) => Infer<E>
  validate: (input: unknown, options: O | undefined) => Result<T>
  opts?: O & CustomTypeOpts
}

export function types<const TS extends Types>(types: TS): TS {
  return types
}

export function number(opts?: NumberType['opts']): NumberType & DecoratorShorcuts<NumberType> {
  if (opts?.multipleOf && opts.multipleOf <= 0) {
    throw new Error('Invalid multipleOf for integer (must be > 0)')
  }
  const t: NumberType = { kind: 'number', opts }
  return { ...t, ...decoratorShorcuts(t) }
}
export function integer(opts?: NumberType['opts']): NumberType & DecoratorShorcuts<NumberType> {
  if (opts?.multipleOf && opts.multipleOf % 1 !== 0) {
    throw new Error('Invalid multipleOf for integer (must be integer)')
  }
  return number({ multipleOf: 1, ...opts })
}

export function string(opts?: StringType['opts']): StringType & DecoratorShorcuts<StringType> {
  const t: StringType = { kind: 'string', opts }
  return { ...t, ...decoratorShorcuts(t) }
}
export function boolean(opts?: BooleanType['opts']): BooleanType & DecoratorShorcuts<BooleanType> {
  const t: BooleanType = { kind: 'boolean', opts }
  return { ...t, ...decoratorShorcuts(t) }
}
export function nullType(): LiteralType<null> & DecoratorShorcuts<LiteralType<null>> {
  const t = literal(null)
  return { ...t, ...decoratorShorcuts(t) }
}
export function literal<const T extends number | string | boolean | null>(
  value: T,
  opts?: LiteralType['opts'],
): LiteralType<T> & DecoratorShorcuts<LiteralType<T>> {
  const t = { kind: 'literal', value, opts } as LiteralType<T>
  return { ...t, ...decoratorShorcuts(t) }
}
export function union<
  const T extends Types,
  const P extends InferProjection<{ kind: 'union-operator'; types: T }> | boolean = false,
>(types: T, opts?: UnionOperator<T, P>['opts']): UnionOperator<T, P> & DecoratorShorcuts<UnionOperator<T>> {
  const t = {
    kind: 'union-operator',
    types,
    opts: { ...opts, requiredProjection: opts?.requiredProjection ?? true },
    static: null as any,
  } as UnionOperator<T, P>
  return { ...t, ...decoratorShorcuts(t) } as UnionOperator<T, P> & DecoratorShorcuts<UnionOperator<T>>
}
export function enumeration<const V extends readonly [string, ...string[]]>(
  values: V,
  opts?: EnumType<V>['opts'],
): EnumType<V> & DecoratorShorcuts<EnumType<V>> {
  const t = { kind: 'enum', values, opts } as EnumType<V>
  return { ...t, ...decoratorShorcuts(t) }
}

export function object<T extends Types>(
  type: T,
  opts?: ObjectType['opts'],
): ObjectType<T> & DecoratorShorcuts<ObjectType<T>> {
  const t = { kind: 'object', type, opts } as ObjectType<T>
  return { ...t, ...decoratorShorcuts(t) }
}

export function array<const T extends LazyType>(
  type: T,
  opts?: ArrayDecorator['opts'],
): ArrayDecorator<T> & DecoratorShorcuts<ArrayDecorator<T>> {
  const t = { kind: 'array-decorator', type, opts } as ArrayDecorator<T>
  return { ...t, ...decoratorShorcuts(t) }
}

export function optional<const T extends LazyType>(
  type: T,
): OptionalDecorator<T> & DecoratorShorcuts<OptionalDecorator<T>, 'optional'> {
  const t = { kind: 'optional-decorator', type } as OptionalDecorator<T>
  return { ...t, ...decoratorShorcuts(t) }
}
export function nullable<const T extends LazyType>(
  type: T,
): NullableDecorator<T> & DecoratorShorcuts<NullableDecorator<T>, 'nullable'> {
  const t = { kind: 'nullable-decorator', type } as NullableDecorator<T>
  return { ...t, ...decoratorShorcuts(t) }
}

export function defaultType<const T extends LazyType>(
  type: T,
  value: Infer<T> | (() => Infer<T>),
): DefaultDecorator<T> & DecoratorShorcuts<DefaultDecorator<T>, 'default'> {
  const t = { kind: 'default-decorator', type, opts: { default: value } } as DefaultDecorator<T>
  return { ...t, ...decoratorShorcuts(t) }
}

export function relation<const T extends LazyType>(type: T): RelationDecorator<T> {
  return { kind: 'relation-decorator', type } as RelationDecorator<T>
}

export function custom<
  const T,
  const E extends LazyType,
  const O extends Record<string, unknown> = Record<string, unknown>,
>(
  custom: Omit<RootCustomType<T, E, O>, 'kind' | 'type' | 'opts'>,
  opts?: O & { description?: string },
): CustomType<T, E, O> {
  const t = { ...custom, kind: 'custom', opts } as RootCustomType<T, E, O>
  return { ...t, ...decoratorShorcuts(t) }
}

type LazyToType<T extends LazyType> = [T] extends [() => infer R] ? R : T

type Selection<T extends LazyType, P extends InferProjection<T>> = [T] extends [ObjectType]
  ? SelectionInternal<T, P> & DecoratorShorcuts<SelectionInternal<T, P>>
  : () => SelectionInternal<T, P> & DecoratorShorcuts<SelectionInternal<T, P>>

type SelectionInternal<LT extends LazyType, P extends GenericProjection> = LazyToType<LT> extends infer T
  ? T extends Type
    ? P extends true
      ? T
      : [T] extends [{ kind: 'object'; type: infer ST }]
      ? {
          kind: 'object'
          type: {
            [K in keyof ST & keyof P]: ST[K] extends LazyType
              ? P[K] extends true
                ? ST[K]
                : P[K] extends GenericProjection
                ? SelectionInternal<ST[K], P[K]>
                : never
              : never
          }
          opts: ObjectType['opts']
        }
      : [T] extends [{ kind: 'union-operator'; types: infer ST }]
      ? {
          kind: 'union-operator'
          types: {
            [K in keyof ST & keyof P]: ST[K] extends LazyType
              ? P[K] extends true
                ? ST[K]
                : P[K] extends GenericProjection
                ? SelectionInternal<ST[K], P[K]>
                : never
              : never
          }
        }
      : [T] extends [{ kind: 'relation-decorator'; type: infer ST }]
      ? ST extends LazyType
        ? { kind: 'relation-decorator'; type: SelectionInternal<ST, P> }
        : never
      : [T] extends [{ kind: 'default-decorator'; type: infer ST }]
      ? ST extends LazyType
        ? { kind: 'default-decorator'; type: SelectionInternal<ST, P> }
        : never
      : [T] extends [{ kind: 'optional-decorator'; type: infer ST }]
      ? ST extends LazyType
        ? { kind: 'optional-decorator'; type: SelectionInternal<ST, P> }
        : never
      : [T] extends [{ kind: 'array-decorator'; type: infer ST }]
      ? ST extends LazyType
        ? { kind: 'array-decorator'; type: SelectionInternal<ST, P> }
        : never
      : T
    : never
  : never

export function select<const T extends LazyType, const P extends InferProjection<T>>(
  type: T,
  projection: P,
): Selection<T, P> {
  function selection(type: LazyType, projection: GenericProjection): LazyType {
    if (typeof type === 'function') {
      return () => selection(type(), projection)
    }
    if (projection === true) {
      return type
    }
    const t = type as AnyType
    if (t.kind === 'object') {
      return {
        kind: 'object',
        type: Object.fromEntries(
          Object.entries(t.type).flatMap(([k, v]) => {
            const subProjection = projection[k]
            if (subProjection) {
              return [[k, selection(v, subProjection)]]
            }
            return []
          }),
        ),
      }
    }
    if (t.kind === 'union-operator') {
      return {
        kind: 'union-operator',
        types: Object.fromEntries(
          Object.entries(t.types).flatMap(([k, v]) => {
            const subProjection = projection[k]
            if (subProjection) {
              return [[k, selection(v, subProjection)]]
            }
            return []
          }),
        ),
      }
    }
    if (
      t.kind === 'array-decorator' ||
      t.kind === 'optional-decorator' ||
      t.kind === 'nullable-decorator' ||
      t.kind === 'default-decorator' ||
      t.kind === 'relation-decorator'
    ) {
      return { kind: t.kind, type: selection(t.type, projection) }
    }
    return type
  }

  const t = selection(type, projection)
  if (typeof t === 'function') {
    return (() => t()) as unknown as Selection<T, P>
  }
  return { ...t, ...decoratorShorcuts(t) } as Selection<T, P> & DecoratorShorcuts<Selection<T, P>>
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
  return { ...t, ...decoratorShorcuts(t) }
}

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
    ? InferType<ST, Partial, Shader>
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
  : [T] extends [{ kind: 'enum'; values: infer V }]
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
  : [T] extends [{ kind: 'enum'; values: infer V }]
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
