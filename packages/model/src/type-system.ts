import { decoder, validator, types } from './index'
import { filterMapObject, mapObject } from './utils'
import { JSONType } from '@mondrian-framework/utils'

export enum Kind {
  Number,
  String,
  Boolean,
  Enum,
  Literal,
  Union,
  Object,
  Array,
  Tuple,
  Optional,
  Nullable,
  Reference,
  Custom,
}

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
  | ObjectType<Mutability, any>
  | ArrayType<Mutability, any>
  | TupleType<Mutability, any>
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
  : [T] extends [ObjectType<"immutable", infer Ts>] ? { readonly [Key in NonOptionalKeys<Ts>]: Infer<Ts[Key]> } & { readonly [Key in OptionalKeys<Ts>]?: Infer<Ts[Key]> }
  : [T] extends [ObjectType<"mutable", infer Ts>] ? { [Key in NonOptionalKeys<Ts>]: Infer<Ts[Key]> } & { [Key in OptionalKeys<Ts>]?: Infer<Ts[Key]> }
  : [T] extends [ArrayType<"immutable", infer T1>] ? readonly Infer<T1>[]
  : [T] extends [ArrayType<"mutable", infer T1>] ? Infer<T1>[]
  : [T] extends [TupleType<"immutable", infer T1>] ?  Readonly<InferTuple<T1>>
  : [T] extends [TupleType<"mutable", infer T1>] ?  InferTuple<T1>
  : [T] extends [OptionalType<infer T1>] ? undefined | Infer<T1>
  : [T] extends [NullableType<infer T1>] ? null | Infer<T1>
  : [T] extends [ReferenceType<infer T1>] ? Infer<T1>
  : [T] extends [CustomType<infer _Name, infer _Options, infer InferredAs>] ? InferredAs
  : [T] extends [(() => infer T1 extends Type)] ? Infer<T1>
  : never

type InferTuple<T extends Type[]> = T extends [infer T1 extends Type, ...infer Ts extends Type[]]
  ? [Infer<T1>, ...InferTuple<Ts>]
  : []

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
  : [T] extends [TupleType<infer M, infer T1>] ? NonNullable<TupleType<M, T1>['options']>
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
  readonly kind: Kind.String
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
  readonly kind: Kind.Number
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
  readonly kind: Kind.Boolean
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
  readonly kind: Kind.Enum
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
  readonly kind: Kind.Literal
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
  readonly kind: Kind.Union
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
  readonly kind: Kind.Object
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
  readonly kind: Kind.Array
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
 * The model of a sequence of elements in the Mondrian framework.
 */
export type TupleType<M extends Mutability, T extends [Type, ...Type[]]> = {
  readonly kind: Kind.Tuple
  readonly elements: T
  readonly mutability: M
  readonly options?: TupleTypeOptions

  immutable(): TupleType<'immutable', T>
  mutable(): TupleType<'mutable', T>
  optional(): OptionalType<TupleType<M, T>>
  nullable(): NullableType<TupleType<M, T>>
  array(): ArrayType<'immutable', TupleType<M, T>>
  reference(): ReferenceType<TupleType<M, T>>
  setOptions(options: TupleTypeOptions): TupleType<M, T>
  updateOptions(options: TupleTypeOptions): TupleType<M, T>
  setName(name: string): TupleType<M, T>
}

/**
 * The options that can be used to define an {@link TupleType `TupleType`}.
 */
export type TupleTypeOptions = BaseOptions

/**
 * The model of a possibly-missing element in the Mondrian framework.
 */
export type OptionalType<T extends Type> = {
  readonly kind: Kind.Optional
  readonly wrappedType: T
  readonly options?: OptionalTypeOptions

  nullable(): NullableType<OptionalType<T>>
  array(): ArrayType<'immutable', OptionalType<T>>
  reference(): ReferenceType<OptionalType<T>>
  setOptions(options: OptionalTypeOptions): OptionalType<T>
  updateOptions(options: OptionalTypeOptions): OptionalType<T>
  setName(name: string): OptionalType<T>
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
  readonly kind: Kind.Reference
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
  kind: Kind.Custom
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
  const constructor = mutable === 'mutable' ? types.mutableObject : types.object
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
  const constructor = mutable === 'mutable' ? types.mutableObject : types.object
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
  const constructor = mutable === 'mutable' ? types.mutableObject : types.object
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
  const pickedFields = filterMapObject(obj.fields, (_, t) => (hasWrapper(t, Kind.Reference) ? undefined : t))
  const constructor = mutable === 'mutable' ? types.mutableObject : types.object
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
  const mappedFields = filterMapObject(obj.fields, (_, t) => (hasWrapper(t, Kind.Optional) ? t : types.optional(t)))
  const constructor = mutable === 'mutable' ? types.mutableObject : types.object
  return () => constructor(mappedFields, options) as ObjectType<M, PartialObjectFields<Ts>>
}

type PartialObjectFields<Ts extends Types> = {
  [K in keyof Ts]: IsReference<Ts[K]> extends true ? Ts[K] : OptionalType<Ts[K]>
}

/**
 * TODO: doc
 */
//prettier-ignore
export type PartialDeep<T extends Type> 
  = [T] extends [UnionType<infer Ts>] ? UnionType<{ [Key in keyof Ts]: PartialDeep<Ts[Key]> }>
  : [T] extends [ObjectType<infer Mutability, infer Ts>] ? ObjectType<Mutability, { [Key in keyof Ts]: OptionalType<PartialDeep<Ts[Key]>> }>
  : [T] extends [ArrayType<infer Mutability, infer T1>] ? ArrayType<Mutability, PartialDeep<T1>>
  : [T] extends [OptionalType<infer T1>] ? OptionalType<PartialDeep<T1>>
  : [T] extends [NullableType<infer T1>] ? NullableType<PartialDeep<T1>>
  : [T] extends [ReferenceType<infer T1>] ? ReferenceType<PartialDeep<T1>>
  : [T] extends [(() => infer T1 extends Type)] ? () => PartialDeep<T1>
  : T

//TODO: better typing
/**
 * TODO: doc
 * @param type
 * @returns
 */
export function partialDeep<T extends Type>(type: T): PartialDeep<T> {
  if (typeof type === 'function') {
    return (() => partialDeep(type())) as PartialDeep<T>
  }
  const concreteType = concretise(type)
  switch (concreteType.kind) {
    case Kind.Reference:
      return types.reference(partialDeep(concreteType.wrappedType)) as PartialDeep<T>
    case Kind.Nullable:
      return types.nullable(partialDeep(concreteType.wrappedType)) as PartialDeep<T>
    case Kind.Optional:
      return types.optional(partialDeep(concreteType.wrappedType)) as PartialDeep<T>
    case Kind.Array:
      return types.array(partialDeep(concreteType.wrappedType)) as PartialDeep<T>
    case Kind.Union:
      return types.union(
        mapObject(concreteType.variants as Record<string, Type>, (_, fieldValue) => partialDeep(fieldValue)),
      ) as PartialDeep<T>
    case Kind.Object:
      return types.object(
        mapObject(concreteType.fields as Record<string, Type>, (_, fieldValue) =>
          types.optional(partialDeep(fieldValue)),
        ),
      ) as PartialDeep<T>
    default:
      return type as PartialDeep<T>
  }
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
       type1.kind === Kind.Number && sameKindAndOptions(type1, type2)
    || type1.kind === Kind.Boolean && sameKindAndOptions(type1, type2)
    || type1.kind === Kind.String && sameKindAndOptions(type1, type2)
    || (type1.kind === Kind.Literal && type1.kind === type2.kind && type1.options === type2.options && type1.literalValue === type2.literalValue)
    || (type1.kind === Kind.Enum && type1.kind === type2.kind && type1.options === type2.options && arraysHaveSameElements(type1.variants, type2.variants))
    || (type1.kind === Kind.Custom && type1.kind === type2.kind && type1.options === type2.options && type1.typeName === type2.typeName)
    || (type1.kind === Kind.Array && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === Kind.Nullable && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === Kind.Optional && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === Kind.Reference && type1.kind === type2.kind && type1.options === type2.options && areEqual(type1.wrappedType, type2.wrappedType))
    || (type1.kind === Kind.Object && type1.kind === type2.kind && type1.options === type2.options && sameFieldsAreSameTypes(type1.fields, type2.fields))
    || (type1.kind === Kind.Union && type1.kind === type2.kind && type1.options === type2.options && sameFieldsAreSameTypes(type1.variants, type2.variants))
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

function hasWrapper(type: Type, kind: Kind.Optional | Kind.Nullable | Kind.Reference | Kind.Array): boolean {
  const concreteType = concretise(type)
  const typeKind = concreteType.kind
  const isWrapperType = 'wrappedType' in concreteType
  return typeKind === kind || (isWrapperType && typeKind !== Kind.Array && hasWrapper(concreteType.wrappedType, kind))
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
export function isNullable(type: Type): type is Lazy<NullableType<Type>> {
  return hasWrapper(type, Kind.Nullable)
}

/**
 * @param type the type to check
 * @returns true if the type is a reference type
 */
export function isReference(type: Type): type is Lazy<ReferenceType<Type>> {
  return hasWrapper(type, Kind.Reference)
}

/**
 * @param type the type to check
 * @returns true if the type is an array type
 */
export function isArray(type: Type): type is Lazy<ArrayType<Mutability, Type>> {
  return hasWrapper(type, Kind.Array)
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
  | TupleType<Mutability, any>
  | ObjectType<Mutability, Types>
  | UnionType<Types> {
  const concreteType = concretise(type)
  return 'wrappedType' in concreteType ? unwrap(concreteType.wrappedType) : concreteType
}

/**
 * Checks if the {@link unwrap}ped type is a scalar type.
 * @param type the type to check
 * @returns false only for {@link ObjectType}, {@link UnionType}, {@link ArrayType}
 */
export function isScalar(type: Type): boolean {
  const unwrapped = unwrap(type)
  const notUnionOrObject = unwrapped.kind !== Kind.Union && unwrapped.kind !== Kind.Object
  return !isArray(type) && notUnionOrObject
}
