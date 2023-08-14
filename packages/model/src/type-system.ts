import { decoder, validator } from './index'
import { filterMapObject } from './utils'
import { JSONType } from '@mondrian-framework/utils'

/**
 * A type that can be defined with the Mondrian framework.
 *
 * To learn more you can read about [the Mondrian model.](https://twinlogix.github.io/mondrian-framework/docs/docs/model)
 */
export type Type = Lazy<
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
  | CustomType<any, {}, any>
>

/**
 * Makes any type lazy.
 */
export type Lazy<T> = T | (() => Lazy<T>)

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
  : [T] extends [UnionType<infer Ts>] ? { [Key in keyof Ts]: { readonly [P in Key]: Infer<Ts[Key]> } }[keyof Ts]
  : [T] extends [ObjectType<"immutable", infer Ts>] ? Readonly<{ [Key in NonOptionalKeys<Ts>]: Infer<Ts[Key]> } & { [Key in OptionalKeys<Ts>]?: Infer<Ts[Key]> }>
  : [T] extends [ObjectType<"mutable", infer Ts>] ? { [Key in NonOptionalKeys<Ts>]: Infer<Ts[Key]> } & { [Key in OptionalKeys<Ts>]?: Infer<Ts[Key]> }
  : [T] extends [ArrayType<"immutable", infer T1>] ? readonly Infer<T1>[]
  : [T] extends [ArrayType<"mutable", infer T1>] ? Infer<T1>[]
  : [T] extends [OptionalType<infer T1>] ? undefined | Infer<T1>
  : [T] extends [NullableType<infer T1>] ? null | Infer<T1>
  : [T] extends [ReferenceType<infer T1>] ? Infer<T1>
  : [T] extends [CustomType<infer _Name, infer _Options, infer InferredAs>] ? InferredAs
  : [T] extends [(() => infer T1 extends Type)] ? Infer<T1>
  : never

// prettier-ignore
export type InferPartial<T extends Type>
  = [T] extends [NumberType] ? number
  : [T] extends [StringType] ? string
  : [T] extends [BooleanType] ? boolean
  : [T] extends [EnumType<infer Vs>] ? Vs[number]
  : [T] extends [LiteralType<infer L>] ? L
  : [T] extends [UnionType<infer Ts>] ? { [Key in keyof Ts]: { readonly [P in Key]: InferPartial<Ts[Key]> } }[keyof Ts]
  : [T] extends [ObjectType<"immutable", infer Ts>] ? { readonly [Key in keyof Ts]?: InferPartial<Ts[Key]> }
  : [T] extends [ObjectType<"mutable", infer Ts>] ? { [Key in keyof Ts]?: InferPartial<Ts[Key]> }
  : [T] extends [ArrayType<"immutable", infer T1>] ? readonly InferPartial<T1>[]
  : [T] extends [ArrayType<"mutable", infer T1>] ? InferPartial<T1>[]
  : [T] extends [OptionalType<infer T1>] ? undefined | InferPartial<T1>
  : [T] extends [NullableType<infer T1>] ? null | InferPartial<T1>
  : [T] extends [ReferenceType<infer T1>] ? InferPartial<T1>
  : [T] extends [CustomType<infer _Name, infer _Options, infer InferredAs>] ? InferredAs
  : [T] extends [(() => infer T1 extends Type)] ? Infer<T1>
  : never

/**
 * TODO: Add doc
 */
type OptionalKeys<T extends Types> = { [K in keyof T]: IsOptional<T[K]> extends true ? K : never }[keyof T]

/**
 * TODO: Add doc
 */
type NonOptionalKeys<T extends Types> = { [K in keyof T]: IsOptional<T[K]> extends true ? never : K }[keyof T]

/**
 * TODO: Add doc
 */
//prettier-ignore
type IsOptional<T extends Type> 
  = [T] extends [OptionalType<infer _T1>] ? true
  : [T] extends [NullableType<infer T1>] ? IsOptional<T1>
  : [T] extends [ReferenceType<infer T1>] ? IsOptional<T1>
  : [T] extends [() => infer T1 extends Type] ? IsOptional<T1>
  : false

/**
 * TODO: Add doc
 */
//prettier-ignore
type IsReference<T extends Type> 
  = [T] extends [ReferenceType<infer _T1>] ? true
  : [T] extends [NullableType<infer T1>] ? IsReference<T1>
  : [T] extends [ReferenceType<infer T1>] ? IsReference<T1>
  : [T] extends [() => infer T1 extends Type] ? IsReference<T1>
  : false

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
  : [T] extends [CustomType<infer N, infer Os, infer T>] ? NonNullable<CustomType<N, Os, T>['options']>
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
export function concretise(type: Type): ConcreteType {
  //TODO: caching by function address?
  let concreteType = type
  while (typeof concreteType === 'function') {
    concreteType = concreteType()
  }
  return concreteType
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
  readonly maximum?: number
  readonly exclusiveMaximum?: number
  readonly minimum?: number
  readonly exclusiveMinimum?: number
  readonly isInteger?: boolean
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
 * TODO: add examples (e.g. result/optional/list)
 */
export type UnionType<Ts extends Types> = {
  readonly kind: 'union'
  readonly variants: Ts
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
  readonly fields: Ts
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

/**
 * The model for a custom-defined type.
 */
export type CustomType<Name extends string, Options extends Record<string, any>, InferredAs> = {
  kind: 'custom'
  typeName: Name
  options?: CustomTypeOptions<Options>

  encode(value: InferredAs, options?: CustomTypeOptions<Options>): JSONType
  decode(
    value: unknown,
    decodingOptions: decoder.Options,
    options?: CustomTypeOptions<Options>,
  ): decoder.Result<InferredAs>
  validate(
    value: InferredAs,
    validationOptions: validator.Options,
    options?: CustomTypeOptions<Options>,
  ): validator.Result

  optional(): OptionalType<CustomType<Name, Options, InferredAs>>
  nullable(): NullableType<CustomType<Name, Options, InferredAs>>
  array(): ArrayType<'immutable', CustomType<Name, Options, InferredAs>>
  reference(): ReferenceType<CustomType<Name, Options, InferredAs>>
  setOptions(options: CustomTypeOptions<Options>): CustomType<Name, Options, InferredAs>
  updateOptions(options: CustomTypeOptions<Options>): CustomType<Name, Options, InferredAs>
  setName(name: string): CustomType<Name, Options, InferredAs>
}

/**
 * The options used to define a {@link CustomTypeOptions `CustomTypeOptions`}.
 */
export type CustomTypeOptions<AdditionalOptions> = BaseOptions & AdditionalOptions

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
  const minimum = options?.minimum
  const exclusiveMinimum = options?.exclusiveMinimum
  const maximum = options?.maximum
  const exclusiveMaximum = options?.exclusiveMaximum
  const lowerBound = minimum && exclusiveMinimum ? Math.max(minimum, exclusiveMinimum) : minimum ?? exclusiveMinimum
  const upperBound = maximum && exclusiveMaximum ? Math.min(maximum, exclusiveMaximum) : maximum ?? exclusiveMaximum
  const exclude = lowerBound === exclusiveMinimum || upperBound === exclusiveMaximum
  if (lowerBound && upperBound) {
    if (exclude && lowerBound === upperBound) {
      throw new Error(
        `Lower bound (${lowerBound}) cannot be equal to upper bound (${upperBound})\nmin ${minimum}\nemin ${exclusiveMinimum}\nmax ${maximum}\nemax ${exclusiveMaximum}`,
      )
    }
    if (lowerBound > upperBound) {
      throw new Error(`Lower bound (${lowerBound}) must be lower or equal to the upper bound (${upperBound})`)
    }
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
 *            inclusiveMinimum: 0,
 *          })
 *
 *          const exampleAge: Age = 24
 *           ```
 */
export function integer(options?: OptionsOf<NumberType>): NumberType {
  return number({ ...options, isInteger: true })
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
  const minLength = options?.minLength
  const maxLength = options?.maxLength
  if (minLength && maxLength && minLength > maxLength) {
    throw new Error(`String type's minimum length (${minLength}) should be lower than its maximum length ${maxLength}`)
  } else if (minLength && !Number.isInteger(minLength)) {
    throw new Error(`The minimum length (${minLength}) must be an integer`)
  } else if (maxLength && !Number.isInteger(maxLength)) {
    throw new Error(`The maximum length (${maxLength}) must be an integer`)
  } else if (minLength && minLength < 0) {
    throw new Error(`The minimum length (${minLength}) cannot be negative`)
  } else if (maxLength && maxLength < 0) {
    throw new Error(`The maximum length (${maxLength}) cannot be negative`)
  }

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
 * @param options the {@link LiteralTypeOptions options} used to define the new `LiteralType`
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
export function union<Ts extends Types>(variants: Ts, options?: OptionsOf<UnionType<Ts>>): UnionType<Ts> {
  return {
    kind: 'union',
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
  fields: Ts,
  options?: OptionsOf<ObjectType<'immutable', Ts>>,
): ObjectType<'immutable', Ts> {
  return {
    kind: 'object',
    mutability: 'immutable',
    fields,
    options,
    immutable() {
      return this
    },
    mutable() {
      return mutableObject(fields, options)
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
  fields: Ts,
  options?: OptionsOf<ObjectType<'mutable', Ts>>,
): ObjectType<'mutable', Ts> {
  return {
    kind: 'object',
    mutability: 'mutable',
    fields,
    options,
    immutable() {
      return object(fields, options)
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
 * @param one the first `ObjectType` to merge
 * @param other the second `ObjectType` to merge
 * @param options the {@link ObjectTypeOptions options} for the new `ObjectType`.
 *                The options of the merged objects are always ignored, even if this property is set to `undefined`
 * @param mutable result object's mutability. Default is 'immutable'.
 * @returns a new {@link ObjectType `ObjectType`} obtained by merging `one` with `other`.
 *          If both objects define a field with the same name, the type of the resulting field is the one defined by
 *          `other`.
 * @example ```ts
 *          const book = object({ name: string(), publishedIn: integer() })
 *          const description = object({ shortDescription: string(), fullDescription: string() })
 *          const bookWithDescription = merge(book, description)
 *          type BookWithDescription = Infer<typeof bookWithDescription>
 *
 *          const exampleBook: BookWithDescription = {
 *            name: "Example book",
 *            publishedIn: 2023,
 *            shortDescription: "...",
 *            fullDescription: "...",
 *          }
 *          ```
 */
export function merge<Ts1 extends Types, Ts2 extends Types, M extends Mutability = 'immutable'>(
  one: Lazy<ObjectType<any, Ts1>>,
  other: Lazy<ObjectType<any, Ts2>>,
  mutable?: M,
  options?: OptionsOf<ObjectType<M, MergeObjectFields<Ts1, Ts2>>>,
): () => ObjectType<M, MergeObjectFields<Ts1, Ts2>> {
  if (typeof one === 'function' || typeof other === 'function') {
    return () =>
      merge(concretise(one) as ObjectType<any, Ts1>, concretise(other) as ObjectType<any, Ts2>, mutable, options)()
  }
  const mergedFields = { ...one.fields, ...other.fields }
  const constructor = mutable === 'mutable' ? mutableObject : object
  return () => constructor(mergedFields, options) as ObjectType<M, MergeObjectFields<Ts1, Ts2>>
}

type MergeObjectFields<Ts1 extends Types, Ts2 extends Types> = {
  [K in keyof Ts1 | keyof Ts2]: K extends keyof Ts2 ? Ts2[K] : K extends keyof Ts1 ? Ts1[K] : never
}

/**
 * @param obj the `ObjectType` to pick
 * @param fields the fields to pick
 * @param options the {@link ObjectTypeOptions options} for the new `ObjectType`.
 *                The options of the result object are always ignored, even if this property is set to `undefined`
 * @param mutable result object's mutability. Default is 'immutable'.
 * @returns a new {@link ObjectType `ObjectType`} obtained by picking only the wanted fields.
 * @example ```ts
 *          const book = object({ name: string(), description: string(), publishedIn: integer() })
 *          const bookWithoutDescription = pick(book, { name: true, publishedIn: true })
 *          type BookWithoutDescription = Infer<typeof bookWithoutDescription>
 *
 *          const exampleBook: BookWithoutDescription = {
 *            name: "Example book",
 *            publishedIn: 2023,
 *          }
 *          ```
 */
export function pick<
  const Ts extends Types,
  const Fields extends { [K in keyof Ts]?: true },
  M extends Mutability = 'immutable',
>(
  obj: Lazy<ObjectType<any, Ts>>,
  fields: Fields,
  mutable?: M,
  options?: OptionsOf<ObjectType<M, Ts>>,
): () => ObjectType<M, PickObjectFields<Ts, Fields>> {
  if (typeof obj === 'function') {
    return () => pick(concretise(obj) as ObjectType<any, Ts>, fields, mutable, options)()
  }
  const pickedFields = filterMapObject(obj.fields, (k, t) => (k in fields && fields[k] === true ? t : undefined))
  const constructor = mutable === 'mutable' ? mutableObject : object
  return () => constructor(pickedFields, options) as ObjectType<M, PickObjectFields<Ts, Fields>>
}

type PickObjectFields<Ts extends Types, Fields extends { [K in keyof Ts]?: true }> = {
  [K in keyof Ts & { [FK in keyof Fields]: Fields[FK] extends true ? FK : never }[keyof Fields]]: Ts[K]
}

/**
 * @param obj the `ObjectType` to pick
 * @param fields the fields to omit
 * @param options the {@link ObjectTypeOptions options} for the new `ObjectType`.
 *                The options of the result object are always ignored, even if this property is set to `undefined`
 * @param mutable result object's mutability. Default is 'immutable'.
 * @returns a new {@link ObjectType `ObjectType`} obtained by omitting the specified fields.
 * @example ```ts
 *          const book = object({ name: string(), description: string(), publishedIn: integer() })
 *          const bookWithoutDescription = omit(book, { description: true })
 *          type BookWithoutDescription = Infer<typeof bookWithoutDescription>
 *
 *          const exampleBook: BookWithoutDescription = {
 *            name: "Example book",
 *            publishedIn: 2023,
 *          }
 *          ```
 */
export function omit<
  const Ts extends Types,
  const Fields extends { [K in keyof Ts]?: true },
  M extends Mutability = 'immutable',
>(
  obj: Lazy<ObjectType<any, Ts>>,
  fields: Fields,
  mutable?: M,
  options?: OptionsOf<ObjectType<M, Ts>>,
): () => ObjectType<M, OmitObjectFields<Ts, Fields>> {
  if (typeof obj === 'function') {
    return () => omit(concretise(obj) as ObjectType<any, Ts>, fields, mutable, options)()
  }
  const pickedFields = filterMapObject(obj.fields, (k, t) => (!(k in fields) || fields[k] !== true ? t : undefined))
  const constructor = mutable === 'mutable' ? mutableObject : object
  return () => constructor(pickedFields, options) as ObjectType<M, OmitObjectFields<Ts, Fields>>
}

type OmitObjectFields<Ts extends Types, Fields extends { [K in keyof Ts]?: true }> = {
  [K in Exclude<keyof Ts, { [FK in keyof Fields]: Fields[FK] extends true ? FK : never }[keyof Fields]>]: Ts[K]
}

/**
 * @param obj the `ObjectType` to remove all reference fields
 * @param options the {@link ObjectTypeOptions options} for the new `ObjectType`.
 *                The options of the result object are always ignored, even if this property is set to `undefined`
 * @param mutable result object's mutability. Default is 'immutable'.
 * @returns a new {@link ObjectType `ObjectType`} obtained by omitting all the reference fields.
 * @example ```ts
 *          const author = object({ id: string() })
 *          const book = object({ name: string(), publishedIn: integer(), author: Author.reference() })
 *          const bookWithoutAuthor = omitReference(book)
 *          type BookWithoutAuthor = Infer<typeof bookWithoutAuthor>
 *
 *          const exampleBook: BookWithoutAuthor = {
 *            name: "Example book",
 *            publishedIn: 2023,
 *          }
 *          ```
 */
export function omitReferences<const Ts extends Types, M extends Mutability = 'immutable'>(
  obj: Lazy<ObjectType<any, Ts>>,
  mutable?: M,
  options?: OptionsOf<ObjectType<M, Ts>>,
): () => ObjectType<M, OmitReferenceObjectFields<Ts>> {
  if (typeof obj === 'function') {
    return () => omitReferences(concretise(obj) as ObjectType<any, Ts>, mutable, options)()
  }
  const pickedFields = filterMapObject(obj.fields, (_, t) => (hasWrapper(t, 'reference') ? undefined : t))
  const constructor = mutable === 'mutable' ? mutableObject : object
  return () => constructor(pickedFields, options) as ObjectType<M, OmitReferenceObjectFields<Ts>>
}

type OmitReferenceObjectFields<Ts extends Types> = {
  [K in { [FK in keyof Ts]: IsReference<Ts[FK]> extends true ? never : FK }[keyof Ts]]: Ts[K]
}

/**
 * @param obj the `ObjectType` to transform
 * @param options the {@link ObjectTypeOptions options} for the new `ObjectType`.
 *                The options of the result object are always ignored, even if this property is set to `undefined`
 * @param mutable result object's mutability. Default is 'immutable'.
 * @returns a new {@link ObjectType `ObjectType`} where every fields is optional.
 * @example ```ts
 *          const book = object({ name: string(), description: string(), publishedIn: integer() })
 *          const partialBook = partial(book)
 *          type PartialBook = Infer<typeof partialBook>
 *
 *          const exampleBook: PartialBook = {
 *            name: undefined,
 *          }
 *          ```
 */
export function partial<const Ts extends Types, M extends Mutability = 'immutable'>(
  obj: Lazy<ObjectType<any, Ts>>,
  mutable?: M,
  options?: OptionsOf<ObjectType<M, Ts>>,
): () => ObjectType<M, PartialObjectFields<Ts>> {
  if (typeof obj === 'function') {
    return () => partial(concretise(obj) as ObjectType<any, Ts>, mutable, options)()
  }
  const mappedFields = filterMapObject(obj.fields, (_, t) => (hasWrapper(t, 'optional') ? t : optional(t)))
  const constructor = mutable === 'mutable' ? mutableObject : object
  return () => constructor(mappedFields, options) as ObjectType<M, PartialObjectFields<Ts>>
}

type PartialObjectFields<Ts extends Types> = {
  [K in keyof Ts]: IsReference<Ts[K]> extends true ? Ts[K] : OptionalType<Ts[K]>
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
  const maxItems = options?.maxItems
  const minItems = options?.minItems
  if (maxItems && !Number.isInteger(maxItems)) {
    throw new Error(`The maximum number of items (${maxItems}) must be an integer`)
  } else if (minItems && !Number.isInteger(minItems)) {
    throw new Error(`The minimum number of items (${minItems}) must be an integer`)
  } else if (minItems && minItems < 0) {
    throw new Error(`The minimum number of items (${minItems}) cannot be negative`)
  } else if (maxItems && maxItems < 0) {
    throw new Error(`The maximum number of items (${maxItems}) cannot be negative`)
  }
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
 * TODO
 */
export function custom<Name extends string, Options extends Record<string, any>, InferredAs>(
  typeName: Name,
  encode: (value: InferredAs, options?: CustomTypeOptions<Options>) => JSONType,
  decode: (
    value: unknown,
    decodingOptions: decoder.Options,
    options?: CustomTypeOptions<Options>,
  ) => decoder.Result<InferredAs>,
  validate: (
    value: InferredAs,
    validationOptions: validator.Options,
    options?: CustomTypeOptions<Options>,
  ) => validator.Result,
  options?: OptionsOf<CustomType<Name, Options, InferredAs>>,
): CustomType<Name, Options, InferredAs> {
  return {
    kind: 'custom',
    typeName,
    options,
    encode,
    decode,
    validate,
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

/**
 * @param one the first type to compare
 * @param other the second type to compare
 * @returns true if the two types model the same type
 * TODO: add documentation and tests
 */
export function areEqual<T extends Type>(one: T, other: T): boolean {
  const type1 = concretise(one)
  const type2 = concretise(other)

  function sameKindAndOptions(one: ConcreteType, other: ConcreteType): boolean {
    return one.kind === other.kind && one.options === other.options
  }

  function arraysHaveSameElements(array1: any[], array2: any[]): boolean {
    return array1.length === array2.length && array1.every((element) => array2.includes(element))
  }

  function sameFieldsAreSameTypes(one: Types, other: Types): boolean {
    const oneKeys = Object.keys(one)
    const otherKeys = Object.keys(other)
    return (
      arraysHaveSameElements(oneKeys, otherKeys) &&
      Object.entries(one).every(([fieldName, fieldType]) => areEqual(other[fieldName], fieldType))
    )
  }

  // prettier-ignore
  return (
       type1.kind === 'number' && sameKindAndOptions(type1, type2)
    || type1.kind === 'boolean' && sameKindAndOptions(type1, type2)
    || type1.kind === 'string' && sameKindAndOptions(type1, type2)
    || (type1.kind === 'literal' && type1.kind === type2.kind && type1.options === type2.options && type1.literalValue === type2.literalValue)
    || (type1.kind === 'enum' && type1.kind === type2.kind && type1.options === type2.options && arraysHaveSameElements(type1.variants, type2.variants))
    || (type1.kind === 'custom' && type1.kind === type2.kind && type1.options === type2.options && type1.typeName === type2.typeName)
    || (type1.kind === 'array' && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === 'nullable' && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === 'optional' && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === 'reference' && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === 'object' && type1.kind === type2.kind && type1.options === type2.options && sameFieldsAreSameTypes(type1.fields, type2.fields))
    || (type1.kind === 'union' && type1.kind === type2.kind && type1.options === type2.options && sameFieldsAreSameTypes(type1.variants, type2.variants))
  )
}

/**
 * @param type the type to check against
 * @param value the value whose type needs to be checked
 * @param decodingOptions the {@link DecodingOptions options} used for the decoding process
 * @param validationOptions the {@link ValidationOptions options} used for the validation process
 * @returns true if `value` is actually a valid member of the type `T`
 */
export function isType<T extends Type>(
  type: T,
  value: unknown,
  decodingOptions?: decoder.Options,
  validationOptions?: validator.Options,
): value is Infer<T> {
  return decoder.decode(type, value, decodingOptions, validationOptions).match(
    (_) => true,
    (_) => false,
  )
}

/**
 * @param type the type to check against
 * @param value the value whose type needs to be checked
 * @param decodingOptions the {@link DecodingOptions options} used for the decoding process
 * @param validationOptions the {@link ValidationOptions options} used for the validation process
 */
export function assertType<T extends Type>(
  type: T,
  value: unknown,
  decodingOptions?: decoder.Options,
  validationOptions?: validator.Options,
): asserts value is Infer<T> {
  decoder.decode(type, value, decodingOptions, validationOptions).match(
    (_) => {},
    (errors) => {
      throw new Error(`Invalid type: ${JSON.stringify(errors)}`)
    },
  )
}

//TODO: export?
function hasWrapper(type: Type, kind: 'optional' | 'nullable' | 'reference'): boolean {
  const concreteType = concretise(type)
  const typeKind = concreteType.kind
  const isWrapperType = typeKind === 'optional' || typeKind === 'nullable' || typeKind === 'reference'
  return typeKind === kind || (isWrapperType && hasWrapper(concreteType.wrappedType, kind))
}

/**
 * @param type the type to check
 * @returns true if the type is an optional type
 */
export function isOptional(type: Type): type is Lazy<OptionalType<Type>> {
  return hasWrapper(type, 'optional')
}
