import { DecodeOptions } from './decoder'
import { DecoratorShorcuts, decoratorShorcuts } from './decorator-shortcut'
import { GenericProjection } from './projection'
import { Result } from './result'
import { LazyTypeWrapper } from './unsafe'
import { Expand } from '@mondrian-framework/utils'

/**
 * A type that can be defined with the Mondrian framework.
 *
 * To learn more you can read about [the Mondrian model.](https://twinlogix.github.io/mondrian-framework/docs/docs/model)
 *
 */
export interface Type {}

/**
 * A type defined lazily as a function returning a `Type`. This can be used
 * to define recursive or mutually-recursive types.
 *
 * To learn more you can read about [recursive types.](https://twinlogix.github.io/mondrian-framework/docs/docs/model/definition#recursion)
 *
 * ## Examples
 *
 * One can define the model of a list of integers recursively:
 *
 * ```ts
 * type IntegerList = Infer<typeof integerList>
 * const integerList = () => object({
 *   head: integer(),
 *   tail: union({ empty: literal("empty"), list: integerList })
 * })
 * ```
 *
 * Here, `integerList` is defined in terms of itself: its tail can either be
 * an the `"empty"` literal or another list. A value of that type would look
 * like this:
 *
 * ```ts
 * const list : IntegerList = {
 *   head: 1,
 *   tail: {
 *     head: 2,
 *     tail: "empty"
 *   }
 * }
 * ```
 *
 */
export type LazyType = Type | (() => Type)

/**
 * `Types` represents a map of `LazyType`s each one with a unique name.
 */
export type Types = Record<string, LazyType>

/**
 * The model of a `string` in the mondrian framework.
 *
 * It can hold additional information in its optional `opts` field:
 * - `maxLength?`: the maximum length of the string
 * - `regex?`: a regex used to determine if the string is valid or not
 * - `minLength?`: the minimum length of the string
 * - `description?`: a description to explain the role of the string
 * - `name?`: a name for the string
 *
 * ## Example
 *
 * Imagine you have to deal with string usernames that can never be empty. A
 * model for such username could be defined as a `StringType` using the `string`
 * utility function and passing it the needed options:
 *
 * ```ts
 * type Username = Infer<typeof username>
 * const username: StringType = string({
 *   name: "username",
 *   description: "a username that is never empty",
 *   minLength: 1,
 * })
 *
 * const exampleUsername: Username = "my_cool_username"
 * ```
 *
 */
export interface StringType extends Type {
  kind: 'string'
  opts?: {
    name?: string
    description?: string
    maxLength?: number
    regex?: RegExp
    minLength?: number
  }
}

/**
 * The model of a `number` in the mondrian framework.
 *
 * It can hold additional information in its optional `opts` field:
 * - `exclusiveMaximum?`: the upper limit (exclusive) of the number
 * - `exclusiveMinimum?`: the lower limit (exclusive) of the number
 * - `minimum?`: the lower limit of the number
 * - `maximum?`: the upper limit of the number
 * - `multipleOf?`: defines a number that it must be the multiple of
 * - `description?`: a description for the role of the number
 * - `name?`: a name for the number
 *
 * ## Examples
 *
 * Imagine you have to deal with the age of a users: it can be thought of as a
 * number that can never be lower than zero. A model for such a data type could
 * look like this:
 *
 * ```ts
 * type Age = Infer<typeof age>
 * const age: NumberType = number({
 *   name: "age",
 *   description: "an age that is never negative",
 *   minimum: 0,
 * })
 *
 * const exampleAge: Age = 24
 * ```
 *
 */
export interface NumberType extends Type {
  kind: 'number'
  opts?: {
    name?: string
    description?: string
    maximum?: number
    minimum?: number
    exclusiveMaximum?: number
    exclusiveMinimum?: number
    multipleOf?: number
  }
}

/**
 * The model of a `boolean` in the mondrian framework.
 *
 * It can hold additional information in its optional `opts` field:
 * - `description?`: a description for the role of the boolean
 * - `name?`: a name for the boolean
 *
 * ## Examples
 *
 * Imagine you have to keep track of a flag that is used to check wether a user
 * is an admin or not. The corresponding model could look like this:
 *
 * ```ts
 * type AdminFlag = Infer<typeof adminFlag>
 * const adminFlag: BooleanType = boolean({
 *   name: "isAdmin",
 *   description: "a flag that is True if the user is also an admin",
 * })
 *
 * const exampleAdminFlag: AdminFlag = true
 * ```
 *
 */
export interface BooleanType extends Type {
  kind: 'boolean'
  opts?: {
    name?: string
    description?: string
  }
}

/**
 * The model of an enumeration in the Mondrian framework.
 *
 * It is used to describe a set of string-based named constants.
 * It can hold additional information in its optional `opts` field:
 * - `name?`: a name for the enum
 * - `description?`: a description for the role of the enum
 *
 * ## Examples
 *
 * Imagine you have to deal with two kind of users: admins and normal users,
 * their type can be modelled with an enum like this:
 *
 * ```ts
 * type UserKind = Infer<typeof userKind>
 * const userKind = enumeration(["ADMIN", "NORMAL"], {
 *   name: "user_kind",
 *   description: "the kind of a user",
 * })
 *
 * const exampleUserKind : UserKind = "ADMIN"
 * ```
 *
 */
export interface EnumType<V extends readonly [string, ...string[]] = readonly [string, ...string[]]> extends Type {
  kind: 'enum'
  values: V
  opts?: {
    name?: string
    description?: string
  }
}

/**
 * The model of a literal type in the Mondrian framework.
 *
 * It can hold additional information in its optional `opts` field:
 * - `name?`: a name for the literal
 * - `description?`: a description for the role of the literal
 *
 * ## Examples
 *
 * Imagine you have to deal with HTTP requests whose HTTP version must be `"2.0"`.
 * The version field could be modelled with a literal type to can guarantee that
 * a request can only be built if its version is the string `"2.0"`:
 *
 * ```ts
 * type RequiredVersion = Infer<typeof requiredVersion>
 * const requiredVersion = literal("2.0", {
 *   name: "requiredVersion",
 *   description: "the required version for the HTTPS requests",
 * })
 *
 * const version: RequiredVersion = "2.0"
 * ```
 *
 */
export interface LiteralType<T extends number | string | boolean | null = null> extends Type {
  kind: 'literal'
  value: T
  opts?: {
    name?: string
    description?: string
  }
}

/**
 * The model of an object in the Mondrian framework.
 *
 * It can contain many fields each one with an associated `Type`;
 * it can also hold additional information in its optional `opts` field:
 * - `name?`: a name for the object
 * - `description?`: a description for the role of the object
 *
 * ## Examples
 *
 * Objects act as the basic building blocks to describe complex structures
 * with Mondrian.
 *
 * Imagine you are modelling a `User` that has a username, an age
 * and a boolean flag to tell if it is an admin or not.
 * Its definition could look like this:
 *
 * ```ts
 * type User = Infer<typeof user>
 * const user = object(
 *   {
 *     username: string(),
 *     age: number(),
 *     isAdmin: boolean(),
 *   },
 *   {
 *     name: 'user',
 *     description: 'a description of a user',
 *   },
 * )
 *
 * const exampleUser: User = {
 *   username: 'Giacomo',
 *   age: 24,
 *   isAdmin: false,
 * }
 * ```
 *
 */
export interface ObjectType<TS extends Types = Types> extends Type {
  kind: 'object'
  type: TS
  opts?: {
    name?: string
    description?: string
  }
}

/**
 * The model of a sequence of elements in the Mondrian framework.
 *
 * This decorator can be used to turn a `Type` in the model of an array
 * of elements of that type.
 *
 * It can also hold additional information in its optional `opts` field:
 * - `name`: a name for the array
 * - `description`: a description for the role of the array
 * - `maxItems`: the maximum number of items the array can hold
 *
 * ## Examples
 *
 * Any model can be turned into the corresponding array model using the
 * `.array()` method:
 *
 * ```ts
 * type StringArray = Infer<typeof stringArray>
 * const stringArray = string().array({
 *   name: "a list of at most 3 strings",
 *   maxItems: 3,
 * })
 *
 * const strings: StringArray = ["hello", " ", "world!"]
 * ```
 *
 */
export interface ArrayDecorator<T extends LazyType = Type> extends Type {
  kind: 'array-decorator'
  type: T
  opts?: {
    name?: string
    description?: string
    maxItems?: number
  }
}

/**
 * The model of an element that could be missing in the Mondrian framework.
 *
 * This decorator can be used to turn a `Type` in the model of an optional type
 * of that element.
 *
 * It can also hold additional information in its optional `opts` field:
 * - `name`: a name for the optional type
 * - `description`: a description for the role of the optional type
 *
 * ## Examples
 *
 * A non-optional `Type` can be turned into the corresponding optional type
 * using the `.optional()` method:
 *
 * ```ts
 * type OptionalNumber = Infer<typeof stringArray>
 * const optionalNumber = number().optional()
 *
 * const exampleMissing: OptionalNumber = undefined
 * const examplePresent: OptionalNumber = 42
 * ```
 *
 */
export interface OptionalDecorator<T extends LazyType = Type> extends Type {
  kind: 'optional-decorator'
  type: T
  opts?: {
    name?: string
    description?: string
  }
}

/**
 * The model of an element that could be null in the Mondrian framework.
 *
 * This decorator can be used to turn a `Type` in the model of a nullable
 * version of that element.
 *
 * It can also hold additional information in its optional `opts` field:
 * - `name`: a name for the nullable type
 * - `description`: a description for the role of the nullable type
 *
 * ## Examples
 *
 * A non-nullable `Type` can be turned into the corresponding nullable type
 * using the `.nullable()` method:
 *
 * ```ts
 * type NullableString = Infer<typeof nullableString>
 * const nullableString = string().nullable()
 *
 * const exampleNull: NullableString = null
 * const examplePresent: NullableString = "Hello, Mondrian!"
 * ```
 *
 */
export interface NullableDecorator<T extends LazyType = Type> extends Type {
  kind: 'nullable-decorator'
  type: T
  opts?: {
    name?: string
    description?: string
  }
}

/**
 * The model of an element with a default value in the Mondrian framework.
 *
 * This decorator can be used to add a default value to any `Type`.
 *
 * It can also hold additional information in its optional `opts` field:
 * - `name`: a name for the nullable type
 * - `description`: a description for the role of the nullable type
 *
 * ## Examples
 *
 */
export interface DefaultDecorator<T extends LazyType = Type> extends Type {
  kind: 'default-decorator'
  type: T
  defaultValue: Infer<T> | (() => Infer<T>)
  opts?: {
    name?: string
    description?: string
  }
}

export interface RelationDecorator<T extends LazyType = Type> extends Type {
  kind: 'relation-decorator'
  type: T
  opts?: {
    name?: string
    description?: string
  }
}

export interface UnionOperator<
  TS extends Types = Types,
  P extends InferProjection<{ kind: 'union-operator'; types: TS }> | boolean = false,
> extends Type {
  kind: 'union-operator'
  types: TS
  opts?: {
    name?: string
    description?: string
    requiredProjection?: P
    is?: {
      [K in keyof TS]: (value: Project<P, { kind: 'union-operator'; types: TS }>) => boolean
    }
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

export type CustomTypeOpts = {
  name?: string
  description?: string
}

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

/**
 * @param opts the options used to define the `NumberType`
 * @throws if the `multipleOf` field of `opts` is less than or equal to 0
 * @returns a `NumberType` with the given options
 */
export function number(opts?: NumberType['opts']): NumberType & DecoratorShorcuts<NumberType> {
  if (opts?.multipleOf && opts.multipleOf <= 0) {
    throw new Error('Invalid multipleOf for integer (must be > 0)')
  }
  const t: NumberType = { kind: 'number', opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param opts the options used to define the `NumberType`
 * @throws if the `multipleOf` field of `opts` is not an integer number
 * @returns a `NumberType` where the `multipleOf` is an integer and defaults to 1 if it not defined in `opts`
 */
export function integer(opts?: NumberType['opts']): NumberType & DecoratorShorcuts<NumberType> {
  if (opts?.multipleOf && opts.multipleOf % 1 !== 0) {
    throw new Error('Invalid multipleOf for integer (must be integer)')
  }
  return number({ multipleOf: 1, ...opts })
}

/**
 * @param opts the options used to define the `StringType`
 * @returns a `StringType` with the given options
 */
export function string(opts?: StringType['opts']): StringType & DecoratorShorcuts<StringType> {
  const t: StringType = { kind: 'string', opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param opts the options used to define the `OptionType`
 * @returns a `BooleanType` with the given options
 */
export function boolean(opts?: BooleanType['opts']): BooleanType & DecoratorShorcuts<BooleanType> {
  const t: BooleanType = { kind: 'boolean', opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param value the value whose literal type will be represented by the returned `LiteralType`
 * @param opts the options used to define the `LiteralType`
 * @returns a `LiteralType` representing the literal type of `value`
 */
export function literal<const T extends number | string | boolean | null>(
  value: T,
  opts?: LiteralType['opts'],
): LiteralType<T> & DecoratorShorcuts<LiteralType<T>> {
  const t: LiteralType<T> = { kind: 'literal', value, opts }
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

/**
 * @param values a non empty array of string values used to define the `EnumType`'s variants
 * @param opts the options used to define the `EnumType`
 * @returns an `EnumType` with the given variants and options
 */
export function enumeration<const V extends readonly [string, ...string[]]>(
  values: V,
  opts?: EnumType<V>['opts'],
): EnumType<V> & DecoratorShorcuts<EnumType<V>> {
  const t: EnumType<V> = { kind: 'enum', values, opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param types an object where each value is itself a type, used to determine the structure of the resulting `ObjectType`
 * @param opts the options used to define the `ObjectType`
 * @returns an `ObjectType` with the provided fields and options
 */
export function object<Ts extends Types>(
  types: Ts,
  opts?: ObjectType['opts'],
): ObjectType<Ts> & DecoratorShorcuts<ObjectType<Ts>> {
  const t: ObjectType<Ts> = { kind: 'object', type: types, opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param type the type of the items held by the resulting `ArrayType`
 * @param opts the options used to define the `ArrayType`
 * @returns an `ArrayType` holding items of the given type, with the given options
 */
export function array<const T extends LazyType>(
  type: T,
  opts?: ArrayDecorator['opts'],
): ArrayDecorator<T> & DecoratorShorcuts<ArrayDecorator<T>> {
  const t: ArrayDecorator<T> = { kind: 'array-decorator', type, opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param type the type of the item held by the resulting `OptionalType`
 * @param opts the options used to define the `OptionalType`
 * @returns an `OptionalType` holding an item of the given type, with the given options
 */
export function optional<const T extends LazyType>(
  type: T,
  opts?: OptionalDecorator['opts'],
): OptionalDecorator<T> & DecoratorShorcuts<OptionalDecorator<T>, 'optional'> {
  const t: OptionalDecorator<T> = { kind: 'optional-decorator', type, opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param type the type of the item held by the resulting `NullableType`
 * @param opts the options used to define the `NullableType`
 * @returns a `NullableType` holding an item of the given type, with the given options
 */
export function nullable<const T extends LazyType>(
  type: T,
  opts?: NullableDecorator['opts'],
): NullableDecorator<T> & DecoratorShorcuts<NullableDecorator<T>, 'nullable'> {
  const t: NullableDecorator<T> = { kind: 'nullable-decorator', type, opts }
  return { ...t, ...decoratorShorcuts(t) }
}

/**
 * @param type the `LazyType` to add a default value to
 * @param defaultValue the default value to add to `type`
 * @param opts the options used to describe the default value
 * @returns a type with the added default value and options
 */
export function defaultType<const T extends LazyType>(
  type: T,
  defaultValue: Infer<T> | (() => Infer<T>),
  opts?: Omit<DefaultDecorator['opts'], 'default'>,
): DefaultDecorator<T> & DecoratorShorcuts<DefaultDecorator<T>, 'default'> {
  const t: DefaultDecorator<T> = { kind: 'default-decorator', type, defaultValue, opts }
  return { ...t, ...decoratorShorcuts(t) }
}

export function relation<const T extends LazyType>(type: T): RelationDecorator<T> {
  const t: RelationDecorator<T> = { kind: 'relation-decorator', type }
  return t
}

export function named<const T extends LazyType>(type: T, name: string): T & DecoratorShorcuts<T, 'named'> {
  return new LazyTypeWrapper(type, { name }) as unknown as T & DecoratorShorcuts<T, 'named'>
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

type Selection<T extends LazyType, P extends InferProjection<T>> = SelectionInternal<T, P> &
  DecoratorShorcuts<SelectionInternal<T, P>>
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
    return new LazyTypeWrapper(() => t()) as Selection<T, P>
  }
  return { ...t, ...decoratorShorcuts(t) } as Selection<T, P>
}

type Merge<T1 extends ObjectType | (() => ObjectType), T2 extends ObjectType | (() => ObjectType)> = [T1] extends [
  ObjectType,
]
  ? [T2] extends [ObjectType]
    ? MergeInternal<T1, T2> & DecoratorShorcuts<MergeInternal<T1, T2>>
    : LazyToType<T2> extends ObjectType
    ? MergeInternal<T1, LazyToType<T2>> & DecoratorShorcuts<MergeInternal<T1, LazyToType<T2>>>
    : never
  : [T2] extends [ObjectType]
  ? LazyToType<T1> extends ObjectType
    ? MergeInternal<LazyToType<T1>, T2> & DecoratorShorcuts<MergeInternal<LazyToType<T1>, T2>>
    : never
  : LazyToType<T1> extends ObjectType
  ? LazyToType<T2> extends ObjectType
    ? MergeInternal<LazyToType<T1>, LazyToType<T2>> & DecoratorShorcuts<MergeInternal<LazyToType<T1>, LazyToType<T2>>>
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
    return new LazyTypeWrapper(() => {
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
