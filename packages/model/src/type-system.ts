import { decoding, validation, types, result, encoding } from './index'
import { NeverType } from './types-exports'
import { memoizeTypeTransformation, memoizeTransformation, failWithInternalError } from './utils'
import { JSONType, mapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'
import { isDeepStrictEqual } from 'util'

/**
 * The possible kinds of types modelled by the Mondrian Framework
 *
 * @see {@link Type}
 */
export enum Kind {
  Number,
  String,
  Boolean,
  Enum,
  Literal,
  Union,
  Object,
  Entity,
  Array,
  Optional,
  Nullable,
  Custom,
}

/**
 * A type that can be defined with the Mondrian framework. Types are used to provide a formal description
 * of your data. In addition, the Mondrian framework can take advantage of these definitions to
 * automatically generate encoders, decoders, and much more
 *
 * @see To learn more about the Mondrian model, read the
 * [online documentation](https://twinlogix.github.io/mondrian-framework/docs/docs/model)
 */
export type Type = ConcreteType | (() => Type)

export type ConcreteType =
  | NumberType
  | StringType
  | BooleanType
  | EnumType
  | LiteralType<any>
  | UnionType<any>
  | ObjectType<Mutability, any>
  | EntityType<Mutability, any>
  | ArrayType<Mutability, any>
  | OptionalType<any>
  | NullableType<any>
  | CustomType

export type Lazy<T extends ConcreteType> = T | (() => Lazy<T>)

export type Concrete<T extends Type> = Exclude<T, () => any>
/**
 * A record of {@link Type `Type`s}
 */
export type Types = { readonly [K in string]: Type }

/**
 * A type that turns a Mondrian {@link Type `Type`} into the equivalent TypeScript's type
 *
 * @example ```ts
 *          const model = types.string()
 *          type Type = types.Infer<typeof model>
 *          // Type = string
 *          ```
 * @example ```ts
 *          const model = types.number().nullable()
 *          type Type = types.Infer<typeof model>
 *          // Type = number | null
 *          ```
 * @example ```ts
 *          const model = types.object({
 *            field1: types.number(),
 *            field2: types.string(),
 *          })
 *          type Type = types.Infer<typeof model>
 *          // Type = { field1: number, field2: string }
 *          ```
 */
// prettier-ignore
export type Infer<T extends Type>
  = [T] extends [NumberType] ? number
  : [T] extends [StringType] ? string
  : [T] extends [BooleanType] ? boolean
  : [T] extends [LiteralType<infer L>] ? L
  : [T] extends [CustomType<any, any, infer InferredAs>] ? InferredAs
  : [T] extends [EnumType<infer Vs>] ? Vs[number]
  : [T] extends [OptionalType<infer T1>] ? undefined | Infer<T1>
  : [T] extends [NullableType<infer T1>] ? null | Infer<T1>
  : [T] extends [ArrayType<infer M, infer T1>] ? InferArray<M, T1>
  : [T] extends [ObjectType<infer M, infer Ts>] ? InferObject<M, Ts>
  : [T] extends [EntityType<infer M, infer Ts>] ? InferEntity<M, Ts>
  : [T] extends [UnionType<infer Ts>] ? InferUnion<Ts>
  : [T] extends [(() => infer T1 extends Type)] ? Infer<T1>
  : never

// prettier-ignore
type InferObject<M extends Mutability, Ts extends Types> =
  ApplyObjectMutability<M,
    { [Key in NonOptionalKeys<Ts>]: Infer<Ts[Key]> } &
    { [Key in OptionalKeys<Ts>]?: Infer<Ts[Key]> }
  >
// prettier-ignore
type InferEntity<M extends Mutability, Ts extends Types> =
ApplyObjectMutability<M,
  { [Key in NonOptionalKeys<Ts>]: Infer<Ts[Key]> } &
  { [Key in OptionalKeys<Ts>]?: Infer<Ts[Key]> }
>
// prettier-ignore
type InferUnion<Ts extends Types> = { [Key in keyof Ts]: Infer<Ts[Key]> }[keyof Ts]
// prettier-ignore
type InferArray<M, T extends Type> = M extends Mutability.Immutable ? Readonly<Infer<T>[]> : Infer<T>[]
// prettier-ignore

export type InferReturn<T extends Type>
  = [T] extends [NumberType] ? number
  : [T] extends [StringType] ? string
  : [T] extends [BooleanType] ? boolean
  : [T] extends [LiteralType<infer L>] ? L
  : [T] extends [CustomType<any, any, infer InferredAs>] ? InferredAs
  : [T] extends [EnumType<infer Vs>] ? Vs[number]
  : [T] extends [OptionalType<infer T1>] ? undefined | InferReturn<T1>
  : [T] extends [NullableType<infer T1>] ? null | InferReturn<T1>
  : [T] extends [ArrayType<infer M, infer T1>] ? InferReturnArray<M, T1>
  : [T] extends [ObjectType<infer M, infer Ts>] ? InferReturnObject<M, Ts>
  : [T] extends [EntityType<infer M, infer Ts>] ? InferReturnEntity<M, Ts>
  : [T] extends [UnionType<infer Ts>] ? InferReturnUnion<Ts>
  : [T] extends [(() => infer T1 extends Type)] ? InferReturn<T1>
  : never

// prettier-ignore
type InferReturnObject<M extends Mutability, Ts extends Types> =
  ApplyObjectMutability<M,
    { [Key in NonOptionalKeysReturn<Ts>]: InferReturn<Ts[Key]> } &
    { [Key in OptionalKeysReturn<Ts>]?: InferReturn<Ts[Key]> }
  >
// prettier-ignore
type InferReturnEntity<M extends Mutability, Ts extends Types> =
ApplyObjectMutability<M,
  { [Key in NonOptionalKeysReturn<Ts>]: InferReturn<Ts[Key]> } &
  { [Key in OptionalKeysReturn<Ts>]?: InferReturn<Ts[Key]> }
>
// prettier-ignore
type InferReturnUnion<Ts extends Types> = { [Key in keyof Ts]: InferReturn<Ts[Key]> }[keyof Ts]
// prettier-ignore
type InferReturnArray<M, T extends Type> = M extends Mutability.Immutable ? Readonly<InferReturn<T>[]> : InferReturn<T>[]

// prettier-ignore
type ApplyObjectMutability<M extends Mutability, T extends Record<string, unknown>> = M extends Mutability.Immutable ? { readonly [K in keyof T]: T[K] } : { [K in keyof T]: T[K] }

/**
 * Given an array of types, returns the union of the fields whose type is optional
 *
 * @example ```ts
 *          const model = types.object({
 *            foo: types.string(),
 *            bar: types.number().optional(),
 *            baz: types.boolean().array().optional(),
 *          })
 *          OptionalKeys<typeof model> // "bar" | "baz"
 *          ```
 */
type OptionalKeys<T extends Types> = {
  [K in keyof T]: IsOptional<T[K]> extends true ? K : never
}[keyof T]

type OptionalKeysReturn<T extends Types> = {
  [K in keyof T]: IsOptional<T[K]> extends true ? K : IsEntity<T[K]> extends true ? K : never
}[keyof T]

/**
 * Given an array of types, returns the union of the fields whose type is not optional
 *
 * @example ```ts
 *          const model = types.object({
 *            foo: types.string(),
 *            bar: types.number().optional(),
 *            baz: types.boolean().array(),
 *          })
 *          OptionalKeys<typeof model> // "foo" | "baz"
 *          ```
 */
type NonOptionalKeys<T extends Types> = {
  [K in keyof T]: IsOptional<T[K]> extends true ? never : K
}[keyof T]

type NonOptionalKeysReturn<T extends Types> = {
  [K in keyof T]: IsOptional<T[K]> extends true ? never : IsEntity<T[K]> extends true ? never : K
}[keyof T]

/**
 * Returns the literal type `true` for any {@link Type} that is optional. That is, if the type has a top-level
 * {@link OptionalType optional wrapper}
 *
 * @example ```ts
 *          const model = types.number().optional().reference()
 *          IsOptional<typeof model> // true
 *          ```
 *          The top-level decorators are `OptionalType` and `ReferenceType` so the type is optional
 * @example ```ts
 *          const model = types.number().optional()
 *          IsOptional<typeof model> // true
 *          ```
 *          The top-level decorator is `OptionalType` so the type is optional
 * @example ```ts
 *          const model = types.number().optional().array()
 *          IsOptional<typeof model> // false
 *          ```
 *          The top-level decorator is `ArrayType` so the type is not optional
 */
//prettier-ignore
type IsOptional<T extends Type> 
  = [T] extends [OptionalType<any>] ? true
  : [T] extends [NullableType<infer T1>] ? IsOptional<T1>
  : [T] extends [(() => infer T1 extends Type)] ? IsOptional<T1>
  : false

//prettier-ignore
type IsEntity<T extends Type> 
  = [T] extends [EntityType<any, any>] ? true
  : [T] extends [OptionalType<infer T1>] ? IsEntity<T1>
  : [T] extends [NullableType<infer T1>] ? IsEntity<T1>
  : [T] extends [ArrayType<any, infer T1>] ? IsEntity<T1>
  : [T] extends [(() => infer T1 extends Type)] ? IsEntity<T1>
  : false

/**
 * Given a {@link Type}, returns the type of the options it can accept when it is defined
 *
 * @example ```ts
 *          type Options = OptionsOf<NumberType>
 *          // Options = NumberTypeOptions
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
  : [T] extends [EntityType<infer Ts, infer Mutable>] ? NonNullable<EntityType<Ts, Mutable>['options']>
  : [T] extends [ArrayType<infer M, infer T1>] ? NonNullable<ArrayType<M, T1>['options']>
  : [T] extends [OptionalType<infer T1>] ? NonNullable<OptionalType<T1>['options']>
  : [T] extends [NullableType<infer T1>] ? NonNullable<NullableType<T1>['options']>
  : [T] extends [CustomType<infer N, infer Os, infer T>] ? NonNullable<CustomType<N, Os, T>['options']>
  : [T] extends [(() => infer T1 extends Type)] ? OptionsOf<T1>
  : never

/**
 * The possible mutability of object and array types
 */
export enum Mutability {
  Mutable,
  Immutable,
}

/**
 * @param type the possibly lazy {@link Type type} to turn into a concrete type
 * @returns a new {@link ConcreteType type} that is guaranteed to not be lazily defined
 * @example if you just work with your own types you will rarely need this function. However,
 *          it can be handy when working with generic types:
 *          ```ts
 *          function do_something<T extends types.Type>(t: T) {
 *            const concrete = types.concretise(t)
 *            // now you can call methods like `validate` on `concrete`
 *          }
 *          ```
 */
export const concretise = memoizeTransformation(concretiseInternal)
function concretiseInternal<T extends Type>(type: T): Concrete<T> {
  return typeof type === 'function' ? concretise(type() as T) : (type as Concrete<T>)
}

/**
 * The basic options that are common to all the types of the Mondrian framework.
 * Every type can be defined by providing its smart constructor a set of options; for example
 * they can be used to perform extra validation, influence the decoding process or customise
 * API generation
 */
export type BaseOptions = {
  readonly name?: string
  readonly description?: string
  readonly sensitive?: boolean
}

/**
 * The model of a `string` in the Mondrian framework
 *
 * @see {@link types.string} to build a `StringType`
 */
export type StringType = {
  readonly kind: Kind.String
  readonly options?: StringTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.string().optional()
   *          types.Infer<typeof model> // string | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<StringType>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.string().nullable()
   *          types.Infer<typeof model> // string | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<StringType>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.string().array()
   *          types.Infer<typeof model> // string[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, StringType>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.string()
   *          model.decode("foo") // succeeds with value: "foo"
   *          model.decode(12) // fails: expected a string, got a number
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<Infer<StringType>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<Infer<StringType>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: Infer<StringType>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.string()
   *          model.encode("foo") // succeeds with value: "foo"
   *          ```
   */
  encode(
    value: Infer<StringType>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: Infer<StringType>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: StringTypeOptions): StringType
  updateOptions(options: StringTypeOptions): StringType
  setName(name: string): StringType

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): StringType
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(): gen.Arbitrary<string>
  /**
   * @param args optional argument:
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { seed?: number }): string
}

/**
 * The options that can be used to define a `StringType`
 */
export type StringTypeOptions = BaseOptions & {
  readonly regex?: RegExp
  readonly maxLength?: number
  readonly minLength?: number
}

/**
 * The model of a `number` in the Mondrian framework
 *
 * @see {@link types.number} to build a `NumberType`
 */
export type NumberType = {
  readonly kind: Kind.Number
  readonly options?: NumberTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.number().optional()
   *          types.Infer<typeof model> // number | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<NumberType>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.number().nullable()
   *          types.Infer<typeof model> // number | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<NumberType>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.number().array()
   *          types.Infer<typeof model> // number[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, NumberType>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.number()
   *          model.decode(12) // succeeds with value: 12
   *          model.decode("foo") // fails: expected a number, got a string
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<Infer<NumberType>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<Infer<NumberType>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: Infer<NumberType>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.number()
   *          model.encode(11) // succeeds with value: 11
   *          ```
   */
  encode(
    value: Infer<NumberType>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: Infer<NumberType>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: NumberTypeOptions): NumberType
  updateOptions(options: NumberTypeOptions): NumberType
  setName(name: string): NumberType

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): NumberType
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(): gen.Arbitrary<number>
  /**
   * @param args optional argument:
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { seed?: number }): number
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
  readonly kind: Kind.Boolean
  readonly options?: BooleanTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.boolean().optional()
   *          types.Infer<typeof model> // boolean | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<BooleanType>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.boolean().nullable()
   *          types.Infer<typeof model> // boolean | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<BooleanType>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.boolean().array()
   *          types.Infer<typeof model> // boolean[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, BooleanType>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.boolean()
   *          model.decode(true) // succeeds with value: true
   *          model.decode("foo") // fails: expected boolean, got a string
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<Infer<BooleanType>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<Infer<BooleanType>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: Infer<BooleanType>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.boolean()
   *          model.encode(true) // succeeds with value: true
   *          ```
   */
  encode(
    value: Infer<BooleanType>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: Infer<BooleanType>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: BooleanTypeOptions): BooleanType
  updateOptions(options: BooleanTypeOptions): BooleanType
  setName(name: string): BooleanType

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): BooleanType
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(): gen.Arbitrary<boolean>
  /**
   * @param args optional argument:
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { seed?: number }): boolean
}

/**
 * The options that can be used to define a {@link BooleanType `BooleanType`}.
 */
export type BooleanTypeOptions = BaseOptions

/**
 * The model of an enumeration in the Mondrian framework.
 */
export type EnumType<Vs extends readonly [string, ...string[]] = readonly [string, ...string[]]> = {
  readonly kind: Kind.Enum
  readonly variants: Vs
  readonly options?: EnumTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.enumeration(["foo", "bar"]).optional()
   *          types.Infer<typeof model> // "foo" | "bar" | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<EnumType<Vs>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.enumeration(["foo", "bar"]).nullable()
   *          types.Infer<typeof model> // "foo" | "bar" | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<EnumType<Vs>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.enumeration(["foo", "bar"]).array()
   *          types.Infer<typeof model> // ("foo" | "bar")[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, EnumType<Vs>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.enumeration(["foo", "bar"])
   *          model.decode("foo") // succeeds with value: "foo"
   *          model.decode("bar") // succeeds with value: "bar"
   *          model.decode("baz") // fails: expected "foo" or "bar", got "baz"
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<Vs[number], validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<Vs[number]>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: Vs[number], validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.enumeration(["foo", "bar"])
   *          model.encode("foo") // succeeds with value: "foo"
   *          ```
   */
  encode(
    value: Vs[number],
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: Vs[number], encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: EnumTypeOptions): EnumType<Vs>
  updateOptions(options: EnumTypeOptions): EnumType<Vs>
  setName(name: string): EnumType<Vs>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): EnumType<Vs>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(): gen.Arbitrary<Vs[number]>
  /**
   * @param args optional argument:
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { seed?: number }): Vs[number]
}

/**
 * The options that can be used to define an {@link EnumType `EnumType`}.
 */
export type EnumTypeOptions = BaseOptions

/**
 * The model of a literal type in the Mondrian framework.
 */
export type LiteralType<L extends number | string | boolean | null = number | string | boolean | null> = {
  readonly kind: Kind.Literal
  readonly literalValue: L
  readonly options?: LiteralTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.literal(1).optional()
   *          types.Infer<typeof model> // 1 | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<LiteralType<L>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.literal(1).nullable()
   *          types.Infer<typeof model> // 1 | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<LiteralType<L>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.literal(1).array()
   *          types.Infer<typeof model> // (1)[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, LiteralType<L>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.literal(1)
   *          model.decode(1) // succeeds with value: 1
   *          model.decode(2) // fails: expected literal 1, got 2
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<L, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<L>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: L, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.literal(1)
   *          model.encode(1) // succeeds with value: 1
   *          ```
   */
  encode(
    value: L,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: L, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: LiteralTypeOptions): LiteralType<L>
  updateOptions(options: LiteralTypeOptions): LiteralType<L>
  setName(name: string): LiteralType<L>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): LiteralType<L>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(): gen.Arbitrary<L>
  /**
   * @param args optional argument:
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { seed?: number }): L
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
  readonly kind: Kind.Union
  readonly variants: Ts
  readonly options?: UnionTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.union({ v1: types.number(), v2: types.string() }).optional()
   *          types.Infer<typeof model> // { v1: number } | { v2: string } | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<UnionType<Ts>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.union({ v1: types.number() }, { v2: types.string() }).nullable()
   *          types.Infer<typeof model> // { v1: number } | { v2: string } | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<UnionType<Ts>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.union({ v1: types.number() }, { v2: types.string() }).array()
   *          types.Infer<typeof model> // ({ v1: number } | { v2: string })[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, UnionType<Ts>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.union({ v1: types.number() }, { v2: types.string() })
   *          model.decode({ v1: 1 }) // succeeds with value: { v1: 1 }
   *          model.decode({ v2: "foo" }) // succeeds with value: { v2: "foo" }
   *          model.decode({ v3: true }) // fails: expected v1 or v2, got v3
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<InferUnion<Ts>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<InferUnion<Ts>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: InferUnion<Ts>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.union({ v1: types.number() }, { v2: types.string() })
   *          model.encode({ v1: 1 }) // succeeds with value: { v1: 1 }
   *          ```
   */
  encode(
    value: InferUnion<Ts>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: InferUnion<Ts>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: UnionTypeOptions): UnionType<Ts>
  updateOptions(options: UnionTypeOptions): UnionType<Ts>
  setName(name: string): UnionType<Ts>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): UnionType<Ts>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<InferUnion<Ts>>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): InferUnion<Ts>

  /**
   * TODO
   * @param value
   */
  variantOwnership(value: InferUnion<Ts>): keyof Ts & string
}

/**
 * The options that can be used to define a {@link UnionType `UnionType`}.
 */
export type UnionTypeOptions = BaseOptions

/**
 * The model of an object in the Mondrian framework.
 */
export type ObjectType<M extends Mutability, Ts extends Types> = {
  readonly kind: Kind.Object
  readonly mutability: M
  readonly fields: Ts
  readonly options?: ObjectTypeOptions

  immutable(): ObjectType<Mutability.Immutable, Ts>
  mutable(): ObjectType<Mutability.Mutable, Ts>

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.object({ field: types.number() }).optional()
   *          types.Infer<typeof model> // { readonly field: number } | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<ObjectType<M, Ts>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.object({ field: types.number() }).nullable()
   *          types.Infer<typeof model> // { readonly field: number } | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<ObjectType<M, Ts>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.object({ field: types.number() }).array()
   *          types.Infer<typeof model> // { readonly field: number }[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, ObjectType<M, Ts>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.object({ field: types.number() })
   *          model.decode({ field: 1 }) // succeeds with value: { field: 1 }
   *          model.decode({ field: "foo" }) // fails: expected a number in `field`, got a string
   *          model.decode({}) // fails: `field` missing
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<InferObject<M, Ts>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<InferObject<M, Ts>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: InferObject<M, Ts>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.object({ field: types.number() })
   *          model.encode({ field: 1 }) // succeeds with value: { field: 1 }
   *          ```
   */
  encode(
    value: InferObject<M, Ts>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: InferObject<M, Ts>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: ObjectTypeOptions): ObjectType<M, Ts>
  updateOptions(options: ObjectTypeOptions): ObjectType<M, Ts>
  setName(name: string): ObjectType<M, Ts>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): ObjectType<M, Ts>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<InferObject<M, Ts>>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): InferObject<M, Ts>
}

/**
 * The options that can be used to define an {@link ObjectType `ObjectType`}.
 */
export type ObjectTypeOptions = BaseOptions

/**
 * The model of an object in the Mondrian framework.
 */
export type EntityType<M extends Mutability, Ts extends Types> = {
  readonly kind: Kind.Entity
  readonly mutability: M
  readonly fields: Ts
  readonly options?: EntityTypeOptions

  immutable(): EntityType<Mutability.Immutable, Ts>
  mutable(): EntityType<Mutability.Mutable, Ts>

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.object({ field: types.number() }).optional()
   *          types.Infer<typeof model> // { readonly field: number } | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<EntityType<M, Ts>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.object({ field: types.number() }).nullable()
   *          types.Infer<typeof model> // { readonly field: number } | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<EntityType<M, Ts>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.object({ field: types.number() }).array()
   *          types.Infer<typeof model> // { readonly field: number }[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, EntityType<M, Ts>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.object({ field: types.number() })
   *          model.decode({ field: 1 }) // succeeds with value: { field: 1 }
   *          model.decode({ field: "foo" }) // fails: expected a number in `field`, got a string
   *          model.decode({}) // fails: `field` missing
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<InferEntity<M, Ts>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<InferEntity<M, Ts>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: InferEntity<M, Ts>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.object({ field: types.number() })
   *          model.encode({ field: 1 }) // succeeds with value: { field: 1 }
   *          ```
   */
  encode(
    value: InferEntity<M, Ts>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: InferEntity<M, Ts>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: EntityTypeOptions): EntityType<M, Ts>
  updateOptions(options: EntityTypeOptions): EntityType<M, Ts>
  setName(name: string): EntityType<M, Ts>
  sensitive(): EntityType<M, Ts>

  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<InferEntity<M, Ts>>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): InferEntity<M, Ts>
}

/**
 * The options that can be used to define an {@link EntityType `EntityType`}.
 */
export type EntityTypeOptions = BaseOptions

/**
 * The model of a sequence of elements in the Mondrian framework.
 */
export type ArrayType<M extends Mutability, T extends Type> = {
  readonly kind: Kind.Array
  readonly mutability: M
  readonly wrappedType: T
  readonly options?: ArrayTypeOptions

  immutable(): ArrayType<Mutability.Immutable, T>
  mutable(): ArrayType<Mutability.Mutable, T>

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.number().array().optional()
   *          types.Infer<typeof model> // number[] | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<ArrayType<M, T>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.number().array().nullable()
   *          types.Infer<typeof model> // number[] | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<ArrayType<M, T>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.number().array().array()
   *          types.Infer<typeof model> // number[][]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, ArrayType<M, T>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.number().array()
   *          model.decode([1, 2, 3]) // succeeds with value: [1, 2, 3]
   *          model.decode(["foo"]) // fails: expected number, got string in first element
   *          model.decode(true) // fails: expected array, got boolean
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<InferArray<M, T>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<InferArray<M, T>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: InferArray<M, T>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.number().array()
   *          model.encode([1, 2, 3]) // succeeds with value: [1, 2, 3]
   *          ```
   */
  encode(
    value: InferArray<M, T>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: InferArray<M, T>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: ArrayTypeOptions): ArrayType<M, T>
  updateOptions(options: ArrayTypeOptions): ArrayType<M, T>
  setName(name: string): ArrayType<M, T>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): ArrayType<M, T>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<InferArray<M, T>>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): InferArray<M, T>
}

/**
 * The options that can be used to define an {@link ArrayType `ArrayType`}:
 * - `maxItems` is the meximum number of items (inclusive) an array can hold
 * - `minItems` is the minimum number of items (inclusive) an array can hold
 */
export type ArrayTypeOptions = BaseOptions & {
  readonly maxItems?: number
  readonly minItems?: number
}

/**
 * The model of a possibly-missing element in the Mondrian framework.
 */
export type OptionalType<T extends Type> = {
  readonly kind: Kind.Optional
  readonly wrappedType: T
  readonly options?: OptionalTypeOptions

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.number().optional().nullable()
   *          types.Infer<typeof model> // number | undefined | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<OptionalType<T>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.number().optional().array()
   *          types.Infer<typeof model> // (number | undefined)[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, OptionalType<T>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.number().optional()
   *          model.decode(undefined) // succeeds with value: undefined
   *          model.decode(1) // succeeds with value: 1
   *          model.decode("foo") // fails: expected number or undefined, got string
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<undefined | Infer<T>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<undefined | Infer<T>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: undefined | Infer<T>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.number().optional()
   *          model.encode(11) // succeeds with value: 11
   *          model.encode(undefined) // succeeds with value: null
   *          ```
   */
  encode(
    value: undefined | Infer<T>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: undefined | Infer<T>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: OptionalTypeOptions): OptionalType<T>
  updateOptions(options: OptionalTypeOptions): OptionalType<T>
  setName(name: string): OptionalType<T>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): OptionalType<T>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<undefined | Infer<T>>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): undefined | Infer<T>
}

/**
 * The options that can be used to define an {@link OptionalType `OptionalType`}.
 */
export type OptionalTypeOptions = BaseOptions

/**
 * The model of a possibly-null element in the Mondrian framework.
 */
export type NullableType<T extends Type> = {
  readonly kind: Kind.Nullable
  readonly wrappedType: T
  readonly options?: NullableTypeOptions

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.number().nullable().optional()
   *          types.Infer<typeof model> // number | null | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<NullableType<T>>

  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.number().nullable().array()
   *          types.Infer<typeof model> // (number | null)[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, NullableType<T>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   * @example ```ts
   *          const model = types.number().nullable()
   *          model.decode(11) // succeeds with value: 11
   *          model.decode(null) // succeeds with value: null
   *          model.decode("foo") // fails: expected number or null, got string
   *          ```
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<null | Infer<T>, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<null | Infer<T>>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: null | Infer<T>, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   * @example ```ts
   *          const model = types.number().nullable()
   *          model.encode(11) // succeeds with value: 11
   *          model.encode(null) // succeeds with value: null
   *          ```
   */
  encode(
    value: null | Infer<T>,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: null | Infer<T>, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: NullableTypeOptions): NullableType<T>
  updateOptions(options: NullableTypeOptions): NullableType<T>
  setName(name: string): NullableType<T>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): NullableType<T>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<null | Infer<T>>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): null | Infer<T>
}

/**
 * The options that can be used to define a {@link NullableType `NullableType`}.
 */
export type NullableTypeOptions = BaseOptions

/**
 * The model for a custom-defined type.
 */
export type CustomType<Name extends string = string, Options extends Record<string, any> = {}, InferredAs = unknown> = {
  kind: Kind.Custom
  typeName: Name
  options?: CustomTypeOptions<Options>

  /**
   * Turns this type into an optional version of itself
   *
   * @example ```ts
   *          const model = types.custom<"my_type", {}, number>(...).optional()
   *          types.Infer<typeof model> // number | undefined
   *          ```
   */
  optional(options?: OptionalTypeOptions): OptionalType<CustomType<Name, Options, InferredAs>>

  /**
   * Turns this type into a nullable version of itself
   *
   * @example ```ts
   *          const model = types.custom<"my_type", {}, number>(...).nullable()
   *          types.Infer<typeof model> // number | null
   *          ```
   */
  nullable(options?: NullableTypeOptions): NullableType<CustomType<Name, Options, InferredAs>>
  /**
   * Turns this type into an array of elements of this type
   *
   * @example ```ts
   *          const model = types.custom<"my_type", {}, number>(...).array()
   *          types.Infer<typeof model> // number[]
   *          ```
   */
  array(options?: ArrayTypeOptions): ArrayType<Mutability.Immutable, CustomType<Name, Options, InferredAs>>

  /**
   * @param value
   * @param decodingOptions
   * @param validationOptions
   */
  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<InferredAs, validation.Error[] | decoding.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the decoded
   * type and this may lead to hard-to-debug bugs! You should never use this function unless you're
   * 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `decode` instead
   *
   * @param value the value to decode
   * @param decodingOptions the options used during the decoding process
   * @returns a {@link result decoding.Result} which holds the decoded value if the decoding process was successful
   */
  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<InferredAs>

  /**
   * @param value the value which will be validated
   * @param validationOptions the options to use for the validation process
   * @returns the {@link validation.Result result} of the validation process. It is a successful result
   *          if the provided value pass all the validation checks, a failure otherwise
   */
  validate(value: InferredAs, validationOptions?: validation.Options): validation.Result

  /**
   * @param value the value to encode into a {@link JSONType}
   * @param validationOptions the options used when validating the value to encode
   * @returns an ok {@link result.Result result} if the value to encode is valid (passes the validation
   *          checks) holding the value encoded as a JSONType. If the type is not valid it is not encoded
   *          and a failing result with the {@link validation.Error validation errors} is returned
   */
  encode(
    value: InferredAs,
    encodingOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]>

  /**
   * ⚠️ Pay attention when using this function since it does not perform validation on the value before
   * encoding it and this may lead to encoding and passing around values that are not valid! You should
   * never use this function unless you're 100% sure you don't need to perform validation.
   *
   * In normal circumstances you will never need this function and should use `encode` instead
   *
   * @param value the value to encode into a {@link JSONType}
   * @returns the value encoded as a `JSONType`
   */
  encodeWithoutValidation(value: InferredAs, encodingOptions?: encoding.Options): JSONType

  /**
   * @param other the type this will get compared to
   * @returns true if the other type is equal to this one, that is
   *          it is of the same kind and has the same options
   */
  equals(other: Type): boolean

  setOptions(options: CustomTypeOptions<Options>): CustomType<Name, Options, InferredAs>
  updateOptions(options: CustomTypeOptions<Options>): CustomType<Name, Options, InferredAs>
  setName(name: string): CustomType<Name, Options, InferredAs>

  /**
   * Flags this type as sensitive. A sensitive type will not be displayed during logging.
   * @returns a copy of this type with the sensitive option set to `true`
   */
  sensitive(): CustomType<Name, Options, InferredAs>
  /**
   * Gets an {@link gen.Arbitrary Arbitrary} generator that respects the semantic of this type.
   * @param maxDepth - Controls the maximum depth for value generation.
   *                   Generation is truncated respecting the type definition when this depth is reached.
   * @returns an arbitrary generator for this specific type.
   */
  arbitrary(maxDepth: number): gen.Arbitrary<InferredAs>
  /**
   * @param args optional arguments:
   *   - `maxDepth`: controls the maximum depth for this value generation.
   *   - `seed`: seed for controlling random generation.
   * @returns a random example value that match this type. Useful for mocking purposes.
   */
  example(args?: { maxDepth?: number; seed?: number }): InferredAs
}

/**
 * The options used to define a {@link CustomTypeOptions `CustomTypeOptions`}.
 */
export type CustomTypeOptions<AdditionalOptions extends Record<string, unknown>> = BaseOptions & AdditionalOptions

/**
 * Given a {@link Type} returns a new type where all the fields of object types are turned into
 * optional fields
 *
 * @example ```ts
 *          const model = types.number()
 *          types.Infer<types.PartialDeep<typeof model>> // number
 *          ```
 * @example ```ts
 *          const model = types.object({ field: number })
 *          types.Infer<types.PartialDeep<typeof model>> // { field?: number }
 *          ```
 * @example ```ts
 *          const model = types.object({ field: number }).array()
 *          types.Infer<types.PartialDeep<typeof model>> // { field?: number }[]
 *          ```
 */
//prettier-ignore
export type PartialDeep<T extends Type> 
  = [T] extends [UnionType<infer Ts>] ? UnionType<{ [Key in keyof Ts]: PartialDeep<Ts[Key]> }>
  : [T] extends [ObjectType<infer Mutability, infer Ts>] ? ObjectType<Mutability, { [Key in keyof Ts]: OptionalType<PartialDeep<Ts[Key]>> }>
  : [T] extends [EntityType<infer Mutability, infer Ts>] ? EntityType<Mutability, { [Key in keyof Ts]: OptionalType<PartialDeep<Ts[Key]>> }>
  : [T] extends [ArrayType<infer Mutability, infer T1>] ? ArrayType<Mutability, PartialDeep<T1>>
  : [T] extends [OptionalType<infer T1>] ? OptionalType<PartialDeep<T1>>
  : [T] extends [NullableType<infer T1>] ? NullableType<PartialDeep<T1>>
  : [T] extends [(() => infer T1 extends Type)] ? () => PartialDeep<T1>
  : T

/**
 * @param type the type whose fields will be all turned into optional types
 * @returns a new {@link Type} where the fields of every {@link ObjectType} appearing in it is turned
 *          into an optional field
 * @example ```ts
 *          const model = types.object({ field: types.string() }).array()
 *          types.partialDeep(model)
 *          // -> same as types.object({ field: types.string().optional() }).array()
 *          ```
 */
export function partialDeep<T extends Type>(type: T): PartialDeep<T> {
  return partialDeepInternal(type) as PartialDeep<T>
}
const partialDeepInternal = memoizeTypeTransformation(
  matcher({
    nullable: ({ wrappedType }) => types.nullable(partialDeep(wrappedType)),
    optional: ({ wrappedType }) => types.optional(partialDeep(wrappedType)),
    array: ({ wrappedType }) => types.array(partialDeep(wrappedType)),
    union: ({ variants }) => types.union(mapObject(variants, (_, fieldValue) => partialDeep(fieldValue))),
    object: ({ fields }) => types.object(mapObject(fields, (_, fieldValue) => types.optional(partialDeep(fieldValue)))),
    entity: ({ fields }) => types.entity(mapObject(fields, (_, fieldValue) => types.optional(partialDeep(fieldValue)))),
    otherwise: (_, t) => t,
  }),
)

/**
 * TODO: add documentation and tests
 * TODO: not working with recursive types
 * @param one the first type to compare
 * @param other the second type to compare
 * @returns true if the two types model the same type
 */
export function areEqual(one: Type, other: Type): boolean {
  if (one == other) {
    return true //same pointer
  }
  const type1 = concretise(one)
  const type2 = concretise(other)

  function haveSameOptions(one: ConcreteType, other: ConcreteType): boolean {
    return isDeepStrictEqual(one.options, other.options)
  }

  function arraysHaveSameElements(array1: readonly any[], array2: readonly any[]): boolean {
    return array1.length === array2.length && array1.every((element) => array2.includes(element))
  }

  function sameFieldsAreSameTypes(one: Types, other: Types): boolean {
    const oneKeys = Object.keys(one)
    const otherKeys = Object.keys(other)
    const haveSameKeys = arraysHaveSameElements(oneKeys, otherKeys)
    return haveSameKeys && Object.entries(one).every(([fieldName, fieldType]) => areEqual(other[fieldName], fieldType))
  }

  if (!haveSameOptions(type1, type2)) {
    return false
  }
  const sameNumber = type1.kind === Kind.Number && type1.kind === type2.kind
  const sameBoolean = type1.kind === Kind.Boolean && type1.kind === type2.kind
  const sameString = type1.kind === Kind.String && type1.kind === type2.kind
  // prettier-ignore
  const sameLiteral = (type1.kind === Kind.Literal && type1.kind === type2.kind && type1.literalValue === type2.literalValue)
  // prettier-ignore
  const sameEnum = (type1.kind === Kind.Enum && type1.kind === type2.kind && arraysHaveSameElements(type1.variants , type2.variants ))
  // prettier-ignore
  const sameCustom = (type1.kind === Kind.Custom && type1.kind === type2.kind && type1.typeName === type2.typeName) //TODO: not enough
  // prettier-ignore
  const sameArray = (type1.kind === Kind.Array && type1.kind === type2.kind && areEqual(type1.wrappedType, type2.wrappedType))
  // prettier-ignore
  const sameNullable = (type1.kind === Kind.Nullable && type1.kind === type2.kind && areEqual(type1.wrappedType, type2.wrappedType))
  // prettier-ignore
  const sameOptional = (type1.kind === Kind.Optional && type1.kind === type2.kind && areEqual(type1.wrappedType, type2.wrappedType))
  // prettier-ignore
  const sameObject = (type1.kind === Kind.Object && type1.kind === type2.kind && sameFieldsAreSameTypes(type1.fields, type2.fields))
  // prettier-ignore
  const sameEntity = (type1.kind === Kind.Entity && type1.kind === type2.kind && sameFieldsAreSameTypes(type1.fields, type2.fields))
  // prettier-ignore
  const sameUnion = (type1.kind === Kind.Union && type1.kind === type2.kind && sameFieldsAreSameTypes(type1.variants, type2.variants))
  // prettier-ignore
  const result = sameNumber || sameBoolean || sameString|| sameLiteral|| sameEnum|| sameCustom|| sameArray|| sameNullable|| sameOptional|| sameObject|| sameEntity|| sameUnion
  return result
}

/**
 * @param type the type to check against
 * @param value the value whose type needs to be checked
 * @param decodingOptions the {@link decoding.Options} used for the decoding process
 * @param validationOptions the {@link validation.Options} used for the validation process
 * @returns true if `value` is actually a valid member of the type `T`
 */
export function isType<T extends Type>(
  type: T,
  value: unknown,
  decodingOptions?: decoding.Options,
  validationOptions?: validation.Options,
): value is Infer<T> {
  return types.concretise(type).decode(value, decodingOptions, validationOptions).isOk
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
  decodingOptions?: decoding.Options,
  validationOptions?: validation.Options,
): asserts value is Infer<T> {
  types
    .concretise(type)
    .decode(value, decodingOptions, validationOptions)
    .match(
      (_) => {},
      (errors) => {
        throw new Error(`Invalid type: ${JSON.stringify(errors)}`)
      },
    )
}

/**
 * Determines whether a given `type` has a wrapper of the specified `kind`.
 *
 * @param type - The type to check.
 * @param kind - The kind of wrapper to look for.
 * @returns `true` if the type has a wrapper of the specified kind, `false` otherwise.
 *
 * @example
 * ```typescript
 * const hasOptionalWrapper = hasWrapper(type, Kind.Optional);
 * ```
 */
export function hasWrapper(type: Type, kind: Kind.Optional | Kind.Nullable | Kind.Array): boolean {
  return match(type, {
    array: (t) => t.kind === kind,
    wrapper: (t) => t.kind === kind || hasWrapper(t.wrappedType, kind),
    otherwise: () => false,
  })
}

/**
 * @param type the type to check
 * @returns true if the type is an optional type
 */
export function isOptional(type: Type): boolean {
  return hasWrapper(type, Kind.Optional)
}

/**
 * @param type the type to check
 * @returns true if the type is a nullable type
 */
export function isNullable(type: Type): type is NullableType<Type> {
  return hasWrapper(type, Kind.Nullable)
}

/**
 * @param type the type to check
 * @returns true if the type is an array type
 */
export function isArray(type: Type): type is ArrayType<Mutability, Type> {
  return hasWrapper(type, Kind.Array)
}

/**
 * @param type the type to check
 * @returns true if the type is an array type
 */
export function isNever(type: Type): type is NeverType {
  return match(type, {
    custom: ({ typeName }) => typeName === 'never',
    otherwise: () => false,
  })
}

/**
 * Unwraps all wrappers around a {@link Type}.
 * The wrappers are: {@link OptionalType}, {@link NullableType}, {@link ReferenceType}, {@link ArrayType}
 * @param type the type to unwrap.
 * @returns the unwrapped type.
 */
export function unwrap(
  type: Type,
):
  | NumberType
  | StringType
  | EnumType<any>
  | BooleanType
  | CustomType<string, {}, unknown>
  | LiteralType<any>
  | ObjectType<Mutability, Types>
  | EntityType<Mutability, Types>
  | UnionType<Types> {
  const concreteType = concretise(type)
  return 'wrappedType' in concreteType ? unwrap(concreteType.wrappedType) : concreteType
}

/**
 * Checks if the {@link unwrap}ped type is a scalar type.
 * @param type the type to check
 * @returns false only for {@link ObjectType}, {@link UnionType}, {@link ArrayType}
 */
export const isScalar: (type: Type) => boolean = matcher({
  scalar: () => true,
  array: () => false,
  wrapper: ({ wrappedType }) => isScalar(wrappedType),
  otherwise: () => false,
})

/**
 * Checks if the {@link unwrap}ped type is a object type.
 * @param type the type to check
 * @returns true only for {@link EntityType}
 */
export const isObject: (type: Type) => boolean = matcher({
  object: () => true,
  array: () => false,
  wrapper: ({ wrappedType }) => isObject(wrappedType),
  otherwise: () => false,
})

/**
 * Checks if the {@link unwrap}ped type is a entity type.
 * @param type the type to check
 * @returns true only for {@link ObjectType}
 */
export const isEntity: (type: Type) => boolean = matcher({
  entity: () => true,
  array: () => false,
  wrapper: ({ wrappedType }) => isEntity(wrappedType),
  otherwise: () => false,
})

/**
 * Matches a given `type` with the corresponding function in `cases`.
 * The return type of each function is generic and can be specified by the user.
 * Some types can be gouped toghether with this keys: scalar, wrapper, otherwhise.
 * The input `type` must be included in the cases.
 *
 * @param type - The type to match.
 * @param cases - An object that maps a set of matcher names to their corresponding functions.
 * @returns The result of the matched function.
 *
 * @example
 * ```typescript
 * types.match(type, {
 *   number: (concreteType, type) => // return something,
 *   string: (concreteType, type) => // return something,
 *   boolean: (concreteType, type) => // return something,
 *   enum: (concreteType, type) => // return something,
 *   literal: (concreteType, type) => // return something,
 *   // scalar: (concreteType, type) => // return something,
 *   array: (concreteType, type) => // return something,
 *   optional: (concreteType, type) => // return something,
 *   nullable: (concreteType, type) => // return something,
 *   // wrapper: (concreteType, type) => // return something,
 *   union: (concreteType, type) => // return something,
 *   object: (concreteType, type) => // return something,
 *   entity: (concreteType, type) => // return something,
 *   custom: (concreteType, type) => // return something,
 *   // otherwhise: (concreteType, type) => // return something,
 * })
 * ```
 */
export function match<const M extends TypeMatch<unknown>>(
  type: MatcherInputType<M>,
  cases: M,
): M extends TypeMatch<infer T> ? T : unknown {
  const t = types.concretise(type as Type)
  const potentialHandlers = {
    [Kind.String]: ['string', 'scalar', 'otherwise'],
    [Kind.Number]: ['number', 'scalar', 'otherwise'],
    [Kind.Boolean]: ['boolean', 'scalar', 'otherwise'],
    [Kind.Literal]: ['literal', 'scalar', 'otherwise'],
    [Kind.Enum]: ['enum', 'scalar', 'otherwise'],
    [Kind.Custom]: ['custom', 'scalar', 'otherwise'],
    [Kind.Object]: ['object', 'record', 'otherwise'],
    [Kind.Entity]: ['entity', 'record', 'otherwise'],
    [Kind.Union]: ['union', 'otherwise'],
    [Kind.Nullable]: ['nullable', 'wrapper', 'otherwise'],
    [Kind.Optional]: ['optional', 'wrapper', 'otherwise'],
    [Kind.Array]: ['array', 'wrapper', 'otherwise'],
  } as const
  for (const handlerName of potentialHandlers[t.kind]) {
    const handler = cases[handlerName]
    if (handler) {
      // @ts-ignore
      return handler(t, type)
    }
  }
  throw failWithInternalError('`types.match` with not exhaustive cases occurs')
}

/**
 * Returns a function that matches a given `type` with the corresponding function in `cases`.
 * The return type of each function is generic and can be specified by the user.
 * Some types can be gouped toghether with this keys: scalar, wrapper, otherwhise.
 * The input `type` must be included in the cases.
 *
 * @param cases - An object that maps a set of matcher names to their corresponding functions.
 * @param options - An optional object that specifies additional options for the matcher.
 * @param options.memoize - A boolean flag that indicates whether to memoize the matched function. Defaults to `false`.
 * @returns A function that takes a `type` parameter and returns the result of the matched function.
 *
 * @example
 * ```typescript
 * const matchType = types.matcher({
 *   number: (concreteType, type) => // return something,
 *   string: (concreteType, type) => // return something,
 *   boolean: (concreteType, type) => // return something,
 *   enum: (concreteType, type) => // return something,
 *   literal: (concreteType, type) => // return something,
 *   // scalar: (concreteType, type) => // return something,
 *   array: (concreteType, type) => // return something,
 *   optional: (concreteType, type) => // return something,
 *   nullable: (concreteType, type) => // return something,
 *   // wrapper: (concreteType, type) => // return something,
 *   union: (concreteType, type) => // return something,
 *   object: (concreteType, type) => // return something,
 *   entity: (concreteType, type) => // return something,
 *   custom: (concreteType, type) => // return something,
 *   // otherwhise: (concreteType, type) => // return something,
 * }, { memoize: true });
 *
 * const result = matchType(type);
 * ```
 */
export function matcher<const M extends TypeMatch<unknown>>(
  cases: M,
  options?: { memoize?: boolean },
): (type: MatcherInputType<M>) => M extends TypeMatch<infer T> ? T : unknown {
  const mapper = (type: Type) => match(type as any, cases)
  return (options?.memoize ? memoizeTransformation(mapper) : mapper) as any
}

/**
 * Handler type for a type match.
 * Each function takes two parameters: the first one is the {@link ConcreteType} and the second one is the original reference of the {@link Type}.
 * The return type of each function is generic and can be specified by the user.
 */
type TypeMatch<T> = {
  /**
   * Maps a matcher name to its corresponding function.
   */
  [K in keyof MatcherNameToType]?: (type: MatcherNameToType[K][0], originalType: MatcherNameToType[K][1]) => T
}

/**
 * Maps of matcher names to type handled by the cases functions. (ConcreteType, LazyType)
 */
type MatcherNameToType = {
  string: [StringType, Lazy<StringType>]
  number: [NumberType, Lazy<NumberType>]
  boolean: [BooleanType, Lazy<BooleanType>]
  literal: [LiteralType, Lazy<LiteralType>]
  enum: [EnumType, Lazy<EnumType>]
  custom: [CustomType, Lazy<CustomType>]
  object: [ObjectType<Mutability, Types>, Lazy<ObjectType<Mutability, Types>>]
  entity: [EntityType<Mutability, Types>, Lazy<EntityType<Mutability, Types>>]
  union: [UnionType<Types>, Lazy<UnionType<Types>>]
  nullable: [NullableType<Type>, Lazy<NullableType<Type>>]
  optional: [OptionalType<Type>, Lazy<OptionalType<Type>>]
  array: [ArrayType<Mutability, Type>, Lazy<ArrayType<Mutability, Type>>]
  record: [
    ObjectType<Mutability, Types> | EntityType<Mutability, Types>,
    Lazy<ObjectType<Mutability, Types>> | Lazy<EntityType<Mutability, Types>>,
  ]
  wrapper: [
    OptionalType<Type> | NullableType<Type> | ArrayType<Mutability, Type>,
    Lazy<OptionalType<Type> | NullableType<Type> | ArrayType<Mutability, Type>>,
  ]
  scalar: [
    StringType | NumberType | BooleanType | LiteralType | EnumType | CustomType,
    Lazy<StringType | NumberType | BooleanType | LiteralType | EnumType | CustomType>,
  ]
  otherwise: [ConcreteType, Type]
}

/**
 * Types covered by cases clausoles.
 */
type MatcherNameToTypeName = {
  string: 'string'
  number: 'number'
  boolean: 'boolean'
  literal: 'literal'
  enum: 'enum'
  custom: 'custom'
  object: 'object'
  entity: 'entity'
  union: 'union'
  nullable: 'nullable'
  optional: 'optional'
  array: 'array'
  record: 'object' | 'entity'
  wrapper: 'array' | 'optional' | 'nullable'
  scalar: 'string' | 'number' | 'boolean' | 'literal' | 'enum' | 'custom'
  otherwise: AllTypeNames
}
//prettier-ignore
type AllTypeNames = 'string' | 'number' | 'boolean' | 'literal' | 'enum' | 'custom' | 'object' | 'entity' | 'union' | 'nullable' | 'optional' | 'array'

/**
 * Given a union of keyof {@link MatcherNameToType} it returns a type that can be safely passed to the matcher in order to cover all the cases.
 */
type MatherInputTypeFromKeys<M extends keyof MatcherNameToType> = AllTypeNames extends MatcherNameToTypeName[M]
  ? Type
  : MatcherNameToType[M] | (() => MatherInputTypeFromKeys<M>)

/**
 * Given a {@link TypeMatch} it returns a type that can be safely passed to the matcher in order to cover all the cases.
 */
type MatcherInputType<M extends TypeMatch<unknown>> = MatherInputTypeFromKeys<
  keyof M extends keyof MatcherNameToType ? keyof M : never
>
