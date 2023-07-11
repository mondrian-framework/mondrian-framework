import { DecodeOptions } from './decoder'
import { GenericProjection } from './projection'
import { Result } from './result'
import { Expand } from '@mondrian-framework/utils'

/**
 * A type that can be defined with the Mondrian framework.
 *
 * To learn more you can read about [the Mondrian model.](https://twinlogix.github.io/mondrian-framework/docs/docs/model)
 */
export type Type =
  | NumberType
  | StringType
  | BooleanType
  | EnumType<any>
  | LiteralType<any>
  | UnionType<any>
  | ObjectType<any, any>
  | ArrayType<any, any>
  | OptionalType<any>
  | NullableType<any>
  | ReferenceType<any>
  | (() => Type)

/**
 * A record of {@link Type `Type`s}.
 */
export type Types = Record<string, Type>

/**
 * The same as type but doesn't include the lazy type definition: `() => Type`.
 * This can be useful to use in pair with {@link concretise conretise} to make
 * sure you are dealing with a type that is not lazy.
 */
export type ConcreteType = Exclude<Type, () => any>

/**
 * Infers the Typescript type equivalent of a given Mondrian {@link Type `Type`}.
 * @example ```ts
 *          const model = string()
 *          type Type = Infer<typeof model>
 *          // -> Type = string
 *          ```
 * @example ```ts
 *          const model = nullable(number())
 *          type Type = Infer<typeof model>
 *          // -> Type = number | null
 *          ```
 * @example ```ts
 *          const model = object({
 *            field1: number(),
 *            field2: string(),
 *          })
 *          type Type = Infer<typeof model>
 *          // -> Type = { field1: number, field2: string }
 *          ```
 */
// prettier-ignore
export type Infer<T extends Type>
  = [T] extends [NumberType] ? number
  : [T] extends [StringType] ? string
  : [T] extends [BooleanType] ? boolean
  : [T] extends [EnumType<infer Vs>] ? Vs[number]
  : [T] extends [LiteralType<infer L>] ? L
  : [T] extends [UnionType<infer Ts>] ? { [Key in keyof Ts]: Infer<Ts[Key]> }[keyof Ts]
  : [T] extends [ObjectType<"immutable", infer Ts>] ? { readonly [Key in keyof Ts]: Infer<Ts[Key]> }
  : [T] extends [ObjectType<"mutable", infer Ts>] ? { [Key in keyof Ts]: Infer<Ts[Key]> }
  : [T] extends [ArrayType<"immutable", infer T1>] ? readonly Infer<T1>[]
  : [T] extends [ArrayType<"mutable", infer T1>] ? Infer<T1>[]
  : [T] extends [OptionalType<infer T1>] ? undefined | Infer<T1>
  : [T] extends [NullableType<infer T1>] ? null | Infer<T1>
  : [T] extends [ReferenceType<infer T1>] ? Infer<T1>
  : [T] extends [(() => infer T1 extends Type)] ? Infer<T1>
  : never

/**
 * Given a type `T`, returns the type of the options it can accept when it is defined.
 *
 * @example ```ts
 *          type Options = OptionsOf<NumberType>
 *          // -> Options = NumberTypeOptions
 *          ```
 */
// prettier-ignore
export type OptionsOf<T extends Type>
  = [T] extends [NumberType] ? NonNullable<NumberType['options']>
  : [T] extends [StringType] ? NonNullable<StringType['options']>
  : [T] extends [BooleanType] ? NonNullable<BooleanType['options']>
  : [T] extends [EnumType<infer T1>] ? NonNullable<EnumType<T1>['options']>
  : [T] extends [LiteralType<infer L>] ? NonNullable<LiteralType<L>['options']>
  : [T] extends [UnionType<infer Ts>] ? NonNullable<UnionType<Ts>['options']>
  : [T] extends [ObjectType<infer Ts, infer Mutable>] ? NonNullable<ObjectType<Ts, Mutable>['options']>
  : [T] extends [ArrayType<infer M, infer T1>] ? NonNullable<ArrayType<M, T1>['options']>
  : [T] extends [OptionalType<infer T1>] ? NonNullable<OptionalType<T1>['options']>
  : [T] extends [NullableType<infer T1>] ? NonNullable<NullableType<T1>['options']>
  : [T] extends [ReferenceType<infer T1>] ? NonNullable<ReferenceType<T1>['options']>
  : [T] extends [(() => infer T1 extends Type)] ? OptionsOf<T1>
  : never

/**
 * The possible mutability of objects and arrays.
 */
export type Mutability = 'mutable' | 'immutable'

/**
 * @param type the possibly lazy {@link Type type} to turn into a concrete type
 * @returns a new {@link ConcreteType type} that is guaranteed to not be a lazily defined function
 */
export function concretise<T extends Type>(type: T): ConcreteType {
  return typeof type === 'function' ? concretise(type()) : type
}

/**
 * The basic options that are common to all types of the Mondrian framework.
 */
export type BaseOptions = {
  readonly name?: string
  readonly description?: string
}

/**
 * The model of a `string` in the Mondrian framework.
 */
export type StringType = {
  readonly kind: 'string'
  readonly options?: StringTypeOptions

  optional(): OptionalType<StringType>
  nullable(): NullableType<StringType>
  array(): ArrayType<'immutable', StringType>
  reference(): ReferenceType<StringType>
  setOptions(options: StringTypeOptions): StringType
  updateOptions(options: StringTypeOptions): StringType
  setName(name: string): StringType
}

/**
 * The options that can be used to define a `StringType`.
 */
export type StringTypeOptions = BaseOptions & {
  readonly regex?: RegExp
  readonly maxLength?: number
  readonly minLength?: number
}

/**
 * The model of a `number` in the Mondrian framework.
 */
export type NumberType = {
  readonly kind: 'number'
  readonly options?: NumberTypeOptions

  optional(): OptionalType<NumberType>
  nullable(): NullableType<NumberType>
  array(): ArrayType<'immutable', NumberType>
  reference(): ReferenceType<NumberType>
  setOptions(options: NumberTypeOptions): NumberType
  updateOptions(options: NumberTypeOptions): NumberType
  setName(name: string): NumberType
}

/**
 * The options that can be used to define a {@link NumberType `NumberType`}.
 */
export type NumberTypeOptions = BaseOptions & {
  readonly maximum?: [number, 'inclusive' | 'exclusive']
  readonly minimum?: [number, 'inclusive' | 'exclusive']
  readonly multipleOf?: number
}

/**
 * The model of a `boolean` in the Mondrian framework.
 */
export type BooleanType = {
  readonly kind: 'boolean'
  readonly options?: BooleanTypeOptions

  optional(): OptionalType<BooleanType>
  nullable(): NullableType<BooleanType>
  array(): ArrayType<'immutable', BooleanType>
  reference(): ReferenceType<BooleanType>
  setOptions(options: BooleanTypeOptions): BooleanType
  updateOptions(options: BooleanTypeOptions): BooleanType
  setName(name: string): BooleanType
}

/**
 * The options that can be used to define a {@link BooleanType `BooleanType`}.
 */
export type BooleanTypeOptions = BaseOptions

/**
 * The model of an enumeration in the Mondrian framework.
 */
export type EnumType<Vs extends readonly [string, ...string[]]> = {
  readonly kind: 'enum'
  readonly variants: Vs
  readonly options?: EnumTypeOptions

  optional(): OptionalType<EnumType<Vs>>
  nullable(): NullableType<EnumType<Vs>>
  array(): ArrayType<'immutable', EnumType<Vs>>
  reference(): ReferenceType<EnumType<Vs>>
  setOptions(options: EnumTypeOptions): EnumType<Vs>
  updateOptions(options: EnumTypeOptions): EnumType<Vs>
  setName(name: string): EnumType<Vs>
}

/**
 * The options that can be used to define an {@link EnumType `EnumType`}.
 */
export type EnumTypeOptions = BaseOptions

/**
 * The model of a literal type in the Mondrian framework.
 */
export type LiteralType<L extends number | string | boolean | null> = {
  readonly kind: 'literal'
  readonly literalValue: L
  readonly options?: LiteralTypeOptions

  optional(): OptionalType<LiteralType<L>>
  nullable(): NullableType<LiteralType<L>>
  array(): ArrayType<'immutable', LiteralType<L>>
  reference(): ReferenceType<LiteralType<L>>
  setOptions(options: LiteralTypeOptions): LiteralType<L>
  updateOptions(options: LiteralTypeOptions): LiteralType<L>
  setName(name: string): LiteralType<L>
}

/**
 * The options that can be used to define a {@link LiteralType `LiteralType`}.
 */
export type LiteralTypeOptions = BaseOptions

/**
 * The model of a tagged union of types in the Mondrian framework.
 */
export type UnionType<Ts extends Types> = {
  readonly kind: 'union'
  readonly variants: Ts
  readonly variantsChecks?: { [Key in keyof Ts]: (_: Infer<UnionType<Ts>>) => boolean }
  readonly options?: UnionTypeOptions

  optional(): OptionalType<UnionType<Ts>>
  nullable(): NullableType<UnionType<Ts>>
  array(): ArrayType<'immutable', UnionType<Ts>>
  reference(): ReferenceType<UnionType<Ts>>
  setOptions(options: UnionTypeOptions): UnionType<Ts>
  updateOptions(options: UnionTypeOptions): UnionType<Ts>
  setName(name: string): UnionType<Ts>
}

/**
 * The options that can be used to define a {@link UnionType `UnionType`}.
 */
export type UnionTypeOptions = BaseOptions

/**
 * The model of an object in the Mondrian framework.
 */
export type ObjectType<M extends Mutability, Ts extends Types> = {
  readonly kind: 'object'
  readonly mutability: M
  readonly types: Ts
  readonly options?: ObjectTypeOptions

  immutable(): ObjectType<'immutable', Ts>
  mutable(): ObjectType<'mutable', Ts>
  optional(): OptionalType<ObjectType<M, Ts>>
  nullable(): NullableType<ObjectType<M, Ts>>
  array(): ArrayType<'immutable', ObjectType<M, Ts>>
  reference(): ReferenceType<ObjectType<M, Ts>>
  setOptions(options: ObjectTypeOptions): ObjectType<M, Ts>
  updateOptions(options: ObjectTypeOptions): ObjectType<M, Ts>
  setName(name: string): ObjectType<M, Ts>
}

/**
 * The options that can be used to define an {@link ObjectType `ObjectType`}.
 */
export type ObjectTypeOptions = BaseOptions

/**
 * The model of a sequence of elements in the Mondrian framework.
 */
export type ArrayType<M extends Mutability, T extends Type> = {
  readonly kind: 'array'
  readonly mutability: M
  readonly wrappedType: T
  readonly options?: ArrayTypeOptions

  immutable(): ArrayType<'immutable', T>
  mutable(): ArrayType<'mutable', T>
  optional(): OptionalType<ArrayType<M, T>>
  nullable(): NullableType<ArrayType<M, T>>
  array(): ArrayType<'immutable', ArrayType<M, T>>
  reference(): ReferenceType<ArrayType<M, T>>
  setOptions(options: ArrayTypeOptions): ArrayType<M, T>
  updateOptions(options: ArrayTypeOptions): ArrayType<M, T>
  setName(name: string): ArrayType<M, T>
}

/**
 * The options that can be used to define an {@link ArrayType `ArrayType`}.
 */
export type ArrayTypeOptions = BaseOptions & {
  readonly maxItems?: number
  readonly minItems?: number
}

/**
 * The model of a possibly-missing element in the Mondrian framework.
 */
export type OptionalType<T extends Type> = {
  readonly kind: 'optional'
  readonly wrappedType: T
  readonly defaultValue?: Infer<T> | (() => Infer<T>)
  readonly options?: OptionalTypeOptions

  nullable(): NullableType<OptionalType<T>>
  array(): ArrayType<'immutable', OptionalType<T>>
  reference(): ReferenceType<OptionalType<T>>
  setOptions(options: OptionalTypeOptions): OptionalType<T>
  updateOptions(options: OptionalTypeOptions): OptionalType<T>
  setName(name: string): OptionalType<T>
  withDefault(value: Infer<T> | (() => Infer<T>)): OptionalType<T>
}

/**
 * The options that can be used to define an {@link OptionalType `OptionalType`}.
 */
export type OptionalTypeOptions = BaseOptions

/**
 * The model of a possibly-null element in the Mondrian framework.
 */
export type NullableType<T extends Type> = {
  readonly kind: 'nullable'
  readonly wrappedType: T
  readonly options?: NullableTypeOptions

  optional(): OptionalType<NullableType<T>>
  array(): ArrayType<'immutable', NullableType<T>>
  reference(): ReferenceType<NullableType<T>>
  setOptions(options: NullableTypeOptions): NullableType<T>
  updateOptions(options: NullableTypeOptions): NullableType<T>
  setName(name: string): NullableType<T>
}

/**
 * The options that can be used to define a {@link NullableType `NullableType`}.
 */
export type NullableTypeOptions = BaseOptions

/**
 * The model for a {@link Type `Type`} that is a reference to another type.
 */
export type ReferenceType<T extends Type> = {
  readonly kind: 'reference'
  readonly wrappedType: T
  readonly options?: ReferenceTypeOptions

  optional(): OptionalType<ReferenceType<T>>
  nullable(): NullableType<ReferenceType<T>>
  array(): ArrayType<'immutable', ReferenceType<T>>
  setOptions(options: ReferenceTypeOptions): ReferenceType<T>
  updateOptions(options: ReferenceTypeOptions): ReferenceType<T>
  setName(name: string): ReferenceType<T>
}

/**
 * The options used to define a {@link ReferenceType `ReferenceType`}.
 */
export type ReferenceTypeOptions = BaseOptions

/*
// TODO: Add custom type back

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
*/

/**
 * @param options the {@link NumberTypeOptions options} used to define the new `NumberType`
 * @throws if the `multipleOf` field of `options` is less than or equal to 0
 * @returns a {@link NumberType `NumberType`} with the given `options`
 * @example Imagine you have to deal with the measurements coming from a thermometer: those values can be thought of as
 *          floating point numbers. A model for such a data type could be defined like this:
 *
 *          ```ts
 *          type Measurement = Infer<typeof measurement>
 *          const measurement = number({
 *            name: "measurement",
 *            description: "a measurement coming from a thermometer",
 *          })
 *
 *          const exampleMeasurement: Measurement = 28.2
 *          ```
 */
export function number(options?: OptionsOf<NumberType>): NumberType {
  if (options?.multipleOf && options.multipleOf <= 0) {
    throw new Error('Invalid multipleOf for integer (must be > 0)')
  }
  return {
    kind: 'number',
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param options the {@link NumberTypeOptions options} used to define the new `NumberType`
 * @throws if the `multipleOf` field of `options` is not an integer number
 * @returns a {@link NumberType `NumberType`} where the `multipleOf` is an integer and defaults to 1 if it not defined
 *          in `options`
 * @example Imagine you have to deal with the age of a users: it can be thought of as an integer number that can never
 *          be lower than zero. A model for such a data type could be defined like this:
 *
 *          ```ts
 *          type Age = Infer<typeof age>
 *          const age = integer({
 *            name: "age",
 *            description: "an age that is never negative",
 *            minimum: [0, "inclusive"],
 *          })
 *
 *          const exampleAge: Age = 24
 *           ```
 */
export function integer(options?: OptionsOf<NumberType>): NumberType {
  if (options?.multipleOf && options.multipleOf % 1 !== 0) {
    throw new Error('Invalid multipleOf for integer (must be integer)')
  }
  return number({ multipleOf: 1, ...options })
}

/**
 * @param options the {@link StringTypeOptions options} used to define the new `StringType`
 * @returns a {@link StringType `StringType`} with the given `options`
 * @example Imagine you have to deal with string usernames that can never be empty.
 *          A model for such username could be defined like this:
 *
 *          ```ts
 *          type Username = Infer<typeof username>
 *          const username = string({
 *            name: "username",
 *            description: "a username that is never empty",
 *            minLength: 1,
 *          })
 *
 *          const exampleUsername: Username = "my_cool_username"
 *          ```
 */
export function string(options?: OptionsOf<StringType>): StringType {
  return {
    kind: 'string',
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param options the {@link BooleanTypeOptions options} used to define the new `BooleanType`
 * @returns a {@link BooleanType `BooleanType`} with the given `options`
 * @example Imagine you have to keep track of a flag that is used to check wether a user is an admin or not.
 *          The corresponding model could be defined like this:
 *
 *          ```ts
 *          type AdminFlag = Infer<typeof adminFlag>
 *          const adminFlag: BooleanType = boolean({
 *            name: "isAdmin",
 *            description: "a flag that is True if the user is also an admin",
 *          })
 *
 *          const exampleAdminFlag: AdminFlag = true
 *          ```
 */
export function boolean(options?: OptionsOf<BooleanType>): BooleanType {
  return {
    kind: 'boolean',
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param variants a non empty array of string values used to define the new `EnumType`'s variants
 * @param options the {@link EnumTypeOptions options} used to define the new `EnumType`
 * @returns an {@link EnumType `EnumType`} with the given `variants` and `options`
 * @example Imagine you have to deal with two kind of users - admins and normal users - their type can be modelled with
 *          an enum like this:
 *
 *          ```ts
 *          type UserKind = Infer<typeof userKind>
 *          const userKind = enumeration(["ADMIN", "NORMAL"], {
 *            name: "user_kind",
 *            description: "the kind of a user",
 *          })
 *
 *          const exampleUserKind : UserKind = "ADMIN"
 *          ```
 */
export function enumeration<const Vs extends readonly [string, ...string[]]>(
  variants: Vs,
  options?: OptionsOf<EnumType<Vs>>,
): EnumType<Vs> {
  return {
    kind: 'enum',
    variants,
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param value the literal value held by the new `LiteralType`
 * @param opts the {@link LiteralTypeOptions options} used to define the new `LiteralType`
 * @returns a {@link LiteralType `LiteralType`} representing the literal type of `value`
 * @example Imagine you have to deal with HTTP requests whose HTTP version must be `"2.0"`.
 *          The version field could be modelled with a literal type to can guarantee that a request can only be built
 *          if its version is the string `"2.0"`:
 *
 *          ```ts
 *          type RequiredVersion = Infer<typeof requiredVersion>
 *          const requiredVersion = literal("2.0", {
 *            name: "requiredVersion",
 *            description: "the required version for the HTTPS requests",
 *          })
 *
 *          const version: RequiredVersion = "2.0"
 *          ```
 */
export function literal<const L extends number | string | boolean | null>(
  literalValue: L,
  options?: OptionsOf<LiteralType<L>>,
): LiteralType<L> {
  return {
    kind: 'literal',
    literalValue,
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param variants a record with the different variants, each one paired with a function that can be used to determine
 *                 wether a value belongs to that variant or not
 * @param options the {@link UnionTypeOptions options} used to define the new `UnionType`
 * @returns a new {@link UnionType `UnionType`} with the provided `variants` and `options`
 * @example Imagine you are modelling TODO
 */
export function union<Ts extends Types>(
  variants: Ts,
  variantsChecks?: { [Key in keyof Ts]: (_: Infer<UnionType<Ts>>) => boolean },
  options?: OptionsOf<UnionType<Ts>>,
): UnionType<Ts> {
  return {
    kind: 'union',
    variants,
    variantsChecks,
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param types an object where each field is itself a {@link Type `Type`}, used to determine the structure of the
 *              new `ObjectType`
 * @param options the {@link ObjectTypeOptions options} used to define the new `ObjectType`
 * @returns an {@link ObjectType `ObjectType`} with the provided `values` and `options`
 * @example Imagine you are modelling a `User` that has a username, an age and a boolean flag to tell if it is an admin
 *          or not. Its definition could look like this:
 *
 *          ```ts
 *          type User = Infer<typeof user>
 *          const user = object(
 *            {
 *              username: string(),
 *              age: number(),
 *              isAdmin: boolean(),
 *            },
 *            {
 *              name: 'user',
 *              description: 'a user with an age and a username',
 *            },
 *          )
 *
 *          const exampleUser: User = {
 *            username: 'Giacomo',
 *            age: 24,
 *            isAdmin: false,
 *          }
 *          ```
 */
export function object<Ts extends Types>(
  types: Ts,
  options?: OptionsOf<ObjectType<'immutable', Ts>>,
): ObjectType<'immutable', Ts> {
  return {
    kind: 'object',
    mutability: 'immutable',
    types,
    options,
    immutable() {
      return this
    },
    mutable() {
      return mutableObject(types, options)
    },
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * The same as the {@link object `object`} function, but the inferred object fields are mutable instead of `readonly`.
 *
 * @param types an object where each field is itself a {@link Type `Type`}, used to determine the structure of the
 *              new `ObjectType`
 * @param options the {@link ObjectTypeOptions options} used to define the new `ObjectType`
 * @returns an {@link ObjectType `ObjectType`} with the provided `values` and `options`
 */
export function mutableObject<Ts extends Types>(
  types: Ts,
  options?: OptionsOf<ObjectType<'mutable', Ts>>,
): ObjectType<'mutable', Ts> {
  return {
    kind: 'object',
    mutability: 'mutable',
    types,
    options,
    immutable() {
      return object(types, options)
    },
    mutable() {
      return this
    },
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * TODO: test that it works with a lazy object and doesn't crash
 *
 * @param one the first `ObjectType` to merge
 * @param other the second `ObjectType` to merge
 * @param options the {@link ObjectTypeOptions options} for the new `ObjectType`.
 *                The options of the merged objects are always ignored, even if this property is set to `undefined`
 * @returns a new {@link ObjectType `ObjectType`} obtained by merging `one` with `other`.
 *          If both objects define a field with the same name, the type of the resulting field is the one defined by
 *          `other`.
 * @example ```ts
 *          const book = object({ name: string(), publishedIn: integer() })
 *          const description = object({ shortDescription: string(), fullDescription: string() })
 *          const bookWithDescription = merge(book, description)
 *          type BookWithDescription = Infer<typeof bookWithDescription>
 *
 *          const exampleBook = {
 *            name: "Example book",
 *            publishedIn: 2023,
 *            shortDescription: "...",
 *            fullDescription: "...",
 *          }
 *          ```
 */
export function merge<Ts1 extends Types, Ts2 extends Types, M extends Mutability>(
  mutable: M,
  one: ObjectType<any, Ts1> | (() => ObjectType<any, Ts1>),
  other: ObjectType<any, Ts2> | (() => ObjectType<any, Ts2>),
  options?: OptionsOf<ObjectType<M, Ts1 & Ts2>>,
): ObjectType<M, Ts1 & Ts2> {
  const object1 = typeof one === 'function' ? one() : one
  const object2 = typeof other === 'function' ? other() : other
  if (mutable == 'immutable') {
    return object({ ...object1.types, ...object2.types }, options) as ObjectType<M, Ts1 & Ts2>
  } else {
    return mutableObject({ ...object1.types, ...object2.types }, options) as ObjectType<M, Ts1 & Ts2>
  }
}

/**
 * @param wrappedType the {@link Type `Type`} describing the items held by the new `ArrayType`
 * @param options the {@link ArrayTypeOptions options} used to define the new `ArrayType`
 * @returns an {@link ArrayType `ArrayType`} holding items of the given type, with the given `options`
 * @example ```ts
 *          type StringArray = Infer<typeof stringArray>
 *          const stringArray = array(string(), {
 *            name: "a list of at most 3 strings",
 *            maxItems: 3,
 *          })
 *
 *          const strings: StringArray = ["hello", " ", "world!"]
 *          ```
 */
export function array<T extends Type>(
  wrappedType: T,
  options?: OptionsOf<ArrayType<'immutable', T>>,
): ArrayType<'immutable', T> {
  return {
    kind: 'array',
    mutability: 'immutable',
    wrappedType,
    options,
    immutable() {
      return this
    },
    mutable() {
      return mutableArray(wrappedType, options)
    },
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * The same as the {@link object `array`} function, but the inferred array is `readonly`.
 *
 * @param wrappedType the {@link Type `Type`} describing the items held by the new `ArrayType`
 * @param options the {@link ArrayTypeOptions options} used to define the new `ArrayType`
 * @returns an {@link ArrayType `ArrayType`} holding items of the given type, with the given `options`
 */
export function mutableArray<T extends Type>(
  wrappedType: T,
  options?: OptionsOf<ArrayType<'mutable', T>>,
): ArrayType<'mutable', T> {
  return {
    kind: 'array',
    mutability: 'mutable',
    wrappedType,
    options,
    immutable() {
      return array(wrappedType, options)
    },
    mutable() {
      return this
    },
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param wrappedType the {@link Type `Type`} describing the item held by the new `OptionalType`
 * @param options the {@link OptionalTypeOptions options} used to define the new `OptionalType`
 * @returns an {@link OptionalType `OptionalType`} holding an item of the given type, with the given `options`
 * @example ```ts
 *          type OptionalNumber = Infer<typeof stringArray>
 *          const optionalNumber = optional(number())
 *
 *          const exampleMissing: OptionalNumber = undefined
 *          const examplePresent: OptionalNumber = 42
 *          ```
 */
export function optional<const T extends Type>(
  wrappedType: T,
  defaultValue?: Infer<T> | (() => Infer<T>),
  options?: OptionsOf<OptionalType<T>>,
): OptionalType<T> {
  return {
    kind: 'optional',
    wrappedType,
    defaultValue,
    options,
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
    withDefault(defaultValue) {
      return optional(wrappedType, defaultValue, options)
    },
  }
}

/**
 * @param wrappedType the {@link Type `Type`} describing the item held by the new `NullableType`
 * @param options the {@link NullableTypeOptions options} used to define the new `NullableType`
 * @returns a {@link NullableType `NullableType`} holding an item of the given type, with the given `options`
 * @example ```ts
 *          type NullableString = Infer<typeof nullableString>
 *          const nullableString = nullable(string())
 *
 *          const exampleNull: NullableString = null
 *          const examplePresent: NullableString = "Hello, Mondrian!"
 *          ```
 */
export function nullable<T extends Type>(wrappedType: T, options?: OptionsOf<NullableType<T>>): NullableType<T> {
  return {
    kind: 'nullable',
    wrappedType,
    options,
    optional() {
      return optional(this)
    },
    array() {
      return array(this)
    },
    reference() {
      return reference(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param wrappedType the {@link Type `Type`} referenced by the resulting `ReferenceType`
 * @param options the {@link ReferenceTypeOptions options} used to define the new `ReferenceType`
 * @returns a {@link ReferenceType `ReferenceType`} wrapping the given type, with the given `options`
 */
export function reference<T extends Type>(wrappedType: T, options?: OptionsOf<ReferenceType<T>>): ReferenceType<T> {
  return {
    kind: 'reference',
    wrappedType,
    options,
    optional() {
      return optional(this)
    },
    nullable() {
      return nullable(this)
    },
    array() {
      return array(this)
    },
    setOptions(options) {
      return setOptions(this, options)
    },
    updateOptions(options) {
      return updateOptions(this, options)
    },
    setName(name) {
      return setName(this, name)
    },
  }
}

/**
 * @param type the {@link Type type} whose options will be updated
 * @param options the options used to create the new updated type
 * @returns a new type whose options are the same as those of the given `type` where any option defined in `options`
 *          replaces the old ones
 * @example ```ts
 *          const n1 = number({ name: "n", description: "a number" })
 *          const n2 = updateOptions(n1, { description: "an even better number" })
 *          // -> n1.options = { name: "n", description: "a number" }
 *          // -> n2.options = { name: "n", description: "an even better number" }
 *          ```
 */
export function updateOptions<T extends Type>(type: T, options: OptionsOf<T>): T {
  if (typeof type === 'function') {
    // TODO: test that this cast is safe
    return (() => updateOptions(type(), options as never)) as T
  } else {
    return { ...type, options: { ...type.options, ...options } }
  }
}

/**
 * @param type the {@link Type type} whose options will be changed
 * @param options the options used to create the new updated type
 * @returns a new type with the same structure of the given `type` but whose options are replaced by the given `options`
 * @example ```ts
 *          const n1 = number({ name: "n1", description: "a number"})
 *          const n2 = setOptions(number, { name: "n2" })
 *          // -> n1.options = { name: "n1", description: "a number" }
 *          // -> n2.options = { name: "n2" }
 *          ```
 */
export function setOptions<T extends Type>(type: T, options: OptionsOf<T>): T {
  if (typeof type === 'function') {
    // TODO: test that this cast is safe
    return (() => setOptions(type(), options as never)) as T
  } else {
    return { ...type, options }
  }
}

/**
 * @param type the {@link Type type} whose name option will be updated
 * @param name the name of the updated type
 * @returns a new type whose options are the same as those of the given `type` where name has been replaced with the
 *          provided name
 * @example ```ts
 *          const n1 = number({ name: "n1", description: "a number" })
 *          const n2 = setName(n1, "n2")
 *          // -> n1.options.name = "n1"
 *          // -> n2.options.name = "n2"
 *          ```
 */
export function setName<T extends Type>(type: T, name: string): T {
  return updateOptions(type, { name } as OptionsOf<T>)
}

/*
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


*/

/*
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
*/

/*
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
*/
