type Type =
  | NumberType
  | StringType
  | BooleanType
  | LiteralType<any>
  | EnumerationType<any>
  | OptionalType<any>
  | NullableType<any>
  | ReferenceType<any>
  | ArrayType<any, any>
  | UnionType<any>
  | ObjectType<any, any>
  | CustomType<any, any, any>
  | (() => Type)

enum Kind {
  Number,
  String,
  Boolean,
  Literal,
  Enumeration,
  Optional,
  Nullable,
  Reference,
  Array,
  Union,
  Object,
  Custom,
}

enum Mutability {
  Mutable,
  Immutable,
}

// prettier-ignore
type Infer<T extends Type>
  = [T] extends [NumberType] ? number
  : [T] extends [StringType] ? string
  : [T] extends [BooleanType] ? boolean
  : [T] extends [LiteralType<infer Literal>] ? Literal
  : [T] extends [EnumerationType<infer Variants>] ? Variants
  : [T] extends [OptionalType<infer WrappedType>] ? undefined | Infer<WrappedType>
  : [T] extends [NullableType<infer WrappedType>] ? null | Infer<WrappedType>
  : [T] extends [ReferenceType<infer ReferencedType>] ? Infer<ReferencedType>
  : [T] extends [ArrayType<Mutability.Mutable, infer ItemType>] ? Infer<ItemType>[]
  : [T] extends [ArrayType<Mutability.Immutable, infer ItemType>] ? readonly Infer<ItemType>[]
  : [T] extends [UnionType<infer Variants>]
    ? { [Variant in keyof Variants]: { readonly [Name in Variant]: Infer<Variants[Variant]> } }[keyof Variants]
  : [T] extends [ObjectType<Mutability.Immutable, infer Fields>]
    ? Readonly<{ [Field in NonOptionalFields<Fields>]: Infer<Fields[Field]> } & { [Field in OptionalFields<Fields>]?: Infer<Fields[Field]> }>
  : [T] extends [ObjectType<Mutability.Mutable, infer Fields>]
    ? { [Field in NonOptionalFields<Fields>]: Infer<Fields[Field]> } & { [Field in OptionalFields<Fields>]?: Infer<Fields[Field]> }
  : [T] extends [CustomType<any, any, infer InferredAs>] ? InferredAs
  : [T] extends [() => infer LazyType extends Type] ? Infer<LazyType>
  : never

type Types = Record<string, Type>

type OptionalFields<Fields extends Types> = {
  [Field in keyof Fields]: IsOptional<Fields[Field]> extends true ? Field : never
}[keyof Fields]

type NonOptionalFields<Fields extends Types> = {
  [Field in keyof Fields]: IsOptional<Fields[Field]> extends true ? never : Field
}[keyof Fields]

// prettier-ignore
type IsOptional<T extends Type> 
  = [T] extends [OptionalType<any>] ? true
  : [T] extends [NullableType<infer WrappedType>] ? IsOptional<WrappedType>
  : [T] extends [ReferenceType<infer ReferencedType>] ? IsOptional<ReferencedType>
  : [T] extends [() => infer LazyType extends Type] ? IsOptional<LazyType>
  : false

interface Methods<T extends Type> {
  optional: () => OptionalType<T>
  nullable: () => NullableType<T>
  reference: () => ReferenceType<T>
  array: () => ArrayType<Mutability.Immutable, T>
  format: () => string
}

type NumberType = {
  readonly kind: Kind.Number
} & Methods<NumberType>

type StringType = {
  readonly kind: Kind.String
} & Methods<StringType>

type BooleanType = {
  readonly kind: Kind.Boolean
} & Methods<BooleanType>

type LiteralType<Literal extends boolean | number | string | null> = {
  readonly kind: Kind.Literal
  readonly value: Literal
} & Methods<LiteralType<Literal>>

type EnumerationType<Variants extends [string, ...string[]]> = {
  readonly kind: Kind.Enumeration
  readonly variants: Variants
} & Methods<EnumerationType<Variants>>

type OptionalType<WrappedType extends Type> = {
  readonly kind: Kind.Optional
  readonly wrappedType: WrappedType
} & Methods<OptionalType<WrappedType>>

type NullableType<WrappedType extends Type> = {
  readonly kind: Kind.Optional
  readonly wrappedType: WrappedType
} & Methods<NullableType<WrappedType>>

type ReferenceType<ReferencedType extends Type> = {
  readonly kind: Kind.Optional
  readonly referencedType: ReferencedType
} & Methods<ReferenceType<ReferencedType>>

type ArrayType<M extends Mutability, ItemType extends Type> = {
  readonly kind: Kind.Array
  readonly itemType: ItemType
  readonly mutability: M
  mutable: () => ArrayType<Mutability.Mutable, ItemType>
  immutable: () => ArrayType<Mutability.Immutable, ItemType>
} & Methods<ArrayType<M, ItemType>>

type UnionType<Variants extends Types> = {
  readonly kind: Kind.Union
  readonly variants: Variants
} & Methods<UnionType<Variants>>

type ObjectType<M extends Mutability, Fields extends Types> = {
  readonly kind: Kind.Object
  readonly fields: Fields
  readonly mutability: M
  mutable: () => ObjectType<Mutability.Mutable, Fields>
  immutable: () => ObjectType<Mutability.Immutable, Fields>
} & Methods<ObjectType<M, Fields>>

type CustomType<Name extends string, Options, InferredAs> = {
  readonly name: Name
  readonly kind: Kind.Custom
} & Methods<CustomType<Name, Options, InferredAs>>

function concretise(type: Type): Exclude<Type, () => Type> {
  let concreteType = type
  while (typeof concreteType === 'function') {
    concreteType = concreteType()
  }
  return concreteType
}
