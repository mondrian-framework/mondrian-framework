export function boolean(): BooleanType {
  return new BooleanImpl()
}

export function string(): StringType {
  return new StringImpl()
}

export function number(): NumberType {
  return new NumberImpl()
}

export function literal<Literal extends number | boolean | string | null>(value: Literal): LiteralType<Literal> {
  return new LiteralImpl(value)
}

export function enumeration<Variants extends [string, ...string[]]>(variants: Variants): EnumerationType<Variants> {
  return new EnumerationImpl(variants)
}

export function optional<WrappedType extends Type>(wrappedType: WrappedType): OptionalType<WrappedType> {
  return new OptionalImpl(wrappedType)
}

export function nullable<WrappedType extends Type>(wrappedType: WrappedType): NullableType<WrappedType> {
  return new NullableImpl(wrappedType)
}

export function reference<ReferencedType extends Type>(referencedType: ReferencedType): ReferenceType<ReferencedType> {
  return new ReferenceImpl(referencedType)
}

export function array<ItemType extends Type>(itemType: ItemType): ArrayType<Mutability.Immutable, ItemType> {
  return new ArrayImpl(Mutability.Immutable, itemType)
}

export function mutableArray<ItemType extends Type>(itemType: ItemType): ArrayType<Mutability.Mutable, ItemType> {
  return new ArrayImpl(Mutability.Mutable, itemType)
}

export function union<Variants extends Types>(variants: Variants): UnionType<Variants> {
  return new UnionImpl(variants)
}

export function object<Fields extends Types>(fields: Fields): ObjectType<Mutability.Immutable, Fields> {
  return new ObjectImpl(Mutability.Immutable, fields)
}

export function mutableObject<Fields extends Types>(fields: Fields): ObjectType<Mutability.Mutable, Fields> {
  return new ObjectImpl(Mutability.Mutable, fields)
}

export function custom<Name extends string, Options, InferredAs>(name: Name): CustomType<Name, Options, InferredAs> {
  return new CustomImpl(name)
}

abstract class DefaultMethods<T extends Type> {
  abstract getThis(): T

  optional(): OptionalType<T> {
    return optional(this.getThis())
  }

  nullable(): NullableType<T> {
    return nullable(this.getThis())
  }

  reference(): ReferenceType<T> {
    return reference(this.getThis())
  }

  array(): ArrayType<Mutability.Immutable, T> {
    return array(this.getThis())
  }
}

class NumberImpl extends DefaultMethods<NumberType> implements NumberType {
  readonly kind = Kind.Number
  getThis = () => this
  format = () => 'number'
}

class StringImpl extends DefaultMethods<StringType> implements StringType {
  readonly kind = Kind.String
  getThis = () => this
  format = () => 'string'
}

class BooleanImpl extends DefaultMethods<BooleanType> implements BooleanType {
  readonly kind = Kind.Boolean
  getThis = () => this
  format = () => 'boolean'
}

class LiteralImpl<Literal extends boolean | number | string | null>
  extends DefaultMethods<LiteralType<Literal>>
  implements LiteralType<Literal>
{
  readonly kind = Kind.Literal
  readonly value: Literal

  constructor(value: Literal) {
    super()
    this.value = value
  }

  getThis = () => this
  format = () => `literal(${this.value})`
}

class EnumerationImpl<Variants extends [string, ...string[]]>
  extends DefaultMethods<EnumerationType<Variants>>
  implements EnumerationType<Variants>
{
  readonly kind = Kind.Enumeration
  readonly variants: Variants

  constructor(variants: Variants) {
    super()
    this.variants = variants
  }

  getThis = () => this
  format = () => `enumeration[${this.variants.join(', ')}]`
}

class OptionalImpl<WrappedType extends Type>
  extends DefaultMethods<OptionalType<WrappedType>>
  implements OptionalType<WrappedType>
{
  readonly kind = Kind.Optional
  readonly wrappedType: WrappedType
  constructor(wrappedType: WrappedType) {
    super()
    this.wrappedType = wrappedType
  }

  getThis = () => this
  format = () => `optional(${concretise(this.wrappedType).format()})`
}

class NullableImpl<WrappedType extends Type>
  extends DefaultMethods<NullableType<WrappedType>>
  implements NullableType<WrappedType>
{
  readonly kind = Kind.Optional
  readonly wrappedType: WrappedType
  constructor(wrappedType: WrappedType) {
    super()
    this.wrappedType = wrappedType
  }

  getThis = () => this
  format = () => `nullable(${concretise(this.wrappedType).format()})`
}

class ReferenceImpl<ReferencedType extends Type>
  extends DefaultMethods<ReferenceType<ReferencedType>>
  implements ReferenceType<ReferencedType>
{
  readonly kind = Kind.Optional
  readonly referencedType: ReferencedType
  constructor(referencedType: ReferencedType) {
    super()
    this.referencedType = referencedType
  }

  getThis = () => this
  format = () => `reference(${concretise(this.referencedType).format()})`
}

class ArrayImpl<M extends Mutability, ItemType extends Type>
  extends DefaultMethods<ArrayType<M, ItemType>>
  implements ArrayType<M, ItemType>
{
  readonly kind = Kind.Array
  readonly mutability: M
  readonly itemType: ItemType

  constructor(mutability: M, itemType: ItemType) {
    super()
    this.itemType = itemType
    this.mutability = mutability
  }

  getThis = () => this
  format = () => `optional(${concretise(this.itemType).format()})`
  mutable = () => mutableArray(this.itemType)
  immutable = () => array(this.itemType)
}

class UnionImpl<Variants extends Types> extends DefaultMethods<UnionType<Variants>> implements UnionType<Variants> {
  readonly kind = Kind.Union
  readonly variants: Variants

  constructor(variants: Variants) {
    super()
    this.variants = variants
  }

  getThis = () => this

  format = () => {
    const prettyVariants = Object.entries(this.variants)
      .map(([name, type]) => `{${name}: ${concretise(type).format()}}`)
      .join(',')
    return `union[${prettyVariants}]`
  }
}

class ObjectImpl<M extends Mutability, Fields extends Types>
  extends DefaultMethods<ObjectType<M, Fields>>
  implements ObjectType<M, Fields>
{
  readonly kind = Kind.Object
  readonly mutability: M
  readonly fields: Fields

  constructor(mutability: M, fields: Fields) {
    super()
    this.fields = fields
    this.mutability = mutability
  }

  getThis = () => this

  format = () => {
    const prettyFields = Object.entries(this.fields)
      .map(([name, type]) => `${name}: ${concretise(type).format()}`)
      .join(', ')
    return `object{${prettyFields}}`
  }

  immutable = () => object(this.fields)
  mutable = () => mutableObject(this.fields)
}

class CustomImpl<Name extends string, Options, InferredAs>
  extends DefaultMethods<CustomType<Name, Options, InferredAs>>
  implements CustomType<Name, Options, InferredAs>
{
  readonly kind = Kind.Custom
  readonly name: Name

  constructor(name: Name) {
    super()
    this.name = name
  }

  getThis = () => this
  format = () => `custom(${this.name})`
}

/**
 *
 *
 *
 *
 *
 *
 *
 */
const prova = object({
  field1: number(),
  field2: string().optional(),
  field3: object({
    subfield1: boolean().reference(),
    subfield2: boolean().reference(),
    subfield3: union({
      variant1: string(),
      variant2: object({
        field1: boolean().reference().array(),
      }),
    }),
  }).optional(),
})

type A = Infer<typeof prova>
