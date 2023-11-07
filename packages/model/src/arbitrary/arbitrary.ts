import { types } from '../index'
import gen from 'fast-check'

/**
 * @return A generator for types' base options.
 *         All of its keys are optional and may be omitted in the generated options.
 */
export function baseOptions(): gen.Arbitrary<types.BaseOptions> {
  return gen.record(baseOptionsGeneratorsRecord(), {
    withDeletedKeys: true,
  })
}

/**
 * @returns A generator for string types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function stringTypeOptions(): gen.Arbitrary<types.OptionsOf<types.StringType>> {
  return gen.integer({ min: 0, max: 500 }).chain((min) => {
    return gen.integer({ min, max: 500 }).chain((max) => {
      return gen.oneof(
        gen.record(
          {
            ...baseOptionsGeneratorsRecord(),
            minLength: gen.constant(min),
            maxLength: gen.constant(max),
          },
          { withDeletedKeys: true },
        ),
        gen.record(
          {
            ...baseOptionsGeneratorsRecord(),
            // ⚠️ possible pain point: there is no generator for regexes so we only
            // generate a regex that matches all inputs.
            // For now this is already enough to cover some test cases
            regex: gen.constantFrom(/.*/, undefined),
          },
          { withDeletedKeys: true },
        ),
      )
    })
  })
}

/**
 * @returns A generator for string types.
 */
export function string(): gen.Arbitrary<types.StringType> {
  return orUndefined(stringTypeOptions()).map(types.string)
}

/**
 * @returns A generator for number types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function numberTypeOptions(): gen.Arbitrary<types.OptionsOf<types.NumberType>> {
  return gen.boolean().chain((isInteger) => {
    const bounds = isInteger ? integerBounds() : doubleBounds()
    return bounds.chain((bounds) => {
      return gen.record(
        { ...baseOptionsGeneratorsRecord(), ...bounds, isInteger: gen.constant(isInteger) },
        { withDeletedKeys: true },
      )
    })
  })
}

function integerBounds() {
  return gen.constant({})
}

function doubleBounds() {
  return gen.constant({})
}

/**
 * @returns A generator for number types.
 */
export function number(): gen.Arbitrary<types.NumberType> {
  return orUndefined(numberTypeOptions()).map(types.number)
}

/**
 * @returns A generator for boolean types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function booleanTypeOptions(): gen.Arbitrary<types.OptionsOf<types.BooleanType>> {
  return baseOptions()
}

/**
 * @returns A generator for boolean types.
 */
export function boolean(): gen.Arbitrary<types.BooleanType> {
  return orUndefined(booleanTypeOptions()).map(types.boolean)
}

/**
 * @returns A generator for literal types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function literalTypeOptions(): gen.Arbitrary<types.OptionsOf<types.LiteralType<any>>> {
  return baseOptions()
}

/**
 * @param literalGenerator the generator for the literal value of the randomly generated literal type
 * @returns a generator for a literal type wrapping the given literal
 */
export function literal<L extends number | string | boolean | null>(
  literalGenerator: gen.Arbitrary<L>,
): gen.Arbitrary<types.LiteralType<L>> {
  return orUndefined(literalTypeOptions()).chain((options) => {
    return literalGenerator.map((literalValue) => {
      return types.literal(literalValue, options)
    })
  })
}

/**
 * @return A generator for enum types' options.
 *         All of its keys are optional and may be omitted in the generated options.
 */
export function enumTypeOptions(): gen.Arbitrary<types.OptionsOf<types.EnumType<any>>> {
  return baseOptions()
}

/**
 * @param variantsGenerator the generator for the variants of the randomly generated enum type
 * @returns a generator for an enum type wrapping the given variants
 */
export function enumeration<Vs extends readonly [string, ...string[]]>(
  variantsGenerator: gen.Arbitrary<Vs>,
): gen.Arbitrary<types.EnumType<Vs>> {
  return orUndefined(enumTypeOptions()).chain((options) => {
    return variantsGenerator.map((variants) => {
      return types.enumeration(variants, options)
    })
  })
}

/**
 * @returns A generator for datetime types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function dateTimeTypeOptions(): gen.Arbitrary<types.OptionsOf<types.DateTimeType>> {
  return gen
    .record(
      {
        ...baseOptionsGeneratorsRecord(),
        minimum: orUndefined(gen.date()),
        maximum: orUndefined(gen.date()),
      },
      { withDeletedKeys: true },
    )
    .map((options) => {
      if (options.maximum && options.minimum && options.maximum.getTime() < options.minimum.getTime()) {
        return { ...options, maximum: options.minimum, minimum: options.minimum }
      }
      return options
    })
}

/**
 * @returns A generator for datetime types.
 */
export function dateTime(): gen.Arbitrary<types.DateTimeType> {
  return orUndefined(dateTimeTypeOptions()).map(types.dateTime)
}

/**
 * @returns A generator for datetime types.
 */
export function unknown(): gen.Arbitrary<types.UnknownType> {
  return gen.constant(types.unknown())
}

/**
 * @returns A generator for timestamp types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function timestampTypeOptions(): gen.Arbitrary<types.OptionsOf<types.TimestampType>> {
  return gen
    .record(
      {
        ...baseOptionsGeneratorsRecord(),
        minimum: orUndefined(gen.date()),
        maximum: orUndefined(gen.date()),
      },
      { withDeletedKeys: true },
    )
    .map((options) => {
      if (options.maximum && options.minimum && options.maximum.getTime() < options.minimum.getTime()) {
        return { ...options, maximum: options.minimum, minimum: options.minimum }
      }
      return options
    })
}

/**
 * @returns A generator for timestamp types.
 */
export function timestamp(): gen.Arbitrary<types.TimestampType> {
  return orUndefined(timestampTypeOptions()).map(types.timestamp)
}

/**
 * @returns A generator for record types.
 */
export function record<T extends types.Type>(fieldTypeGen: gen.Arbitrary<T>): gen.Arbitrary<types.RecordType<T>> {
  return fieldTypeGen.map(types.record)
}

/**
 * Turns a record into a record of generators: each of its fields is wrapped in an Arbitrary.
 * @example ```ts
 *          GeneratorsRecord<{ field1: number, field2: string }>
 *          // -> { field1: Arbitrary<number>, field2: Arbitrary<string> }
 *          ```
 */
export type GeneratorsRecord<R extends Record<string, any>> = { [Key in keyof R]: gen.Arbitrary<R[Key]> }

/**
 * @return A generator for union types' options.
 *         All of its keys are optional and may be omitted in the generated options.
 */
export function unionTypeOptions(): gen.Arbitrary<types.OptionsOf<types.UnionType<any>>> {
  return gen.record({
    ...baseOptions,
    // This can cause problem on tests like 'encoding is the inverse of decoding' because with union
    // this is not always true. Take for example this type:
    // types.union({ v1: types.object({}), v2: types.object({ a: types.number() }) })
    // the encoding of { a: 1 } is { a: 1 }, the decoding of { a: 1 } could be {} if we enable 'allowAdditionalFields' option
  })
}

/**
 * @param variantsGenerators a generator for the variants of the randomly generated union type
 * @returns a generator for a union type
 */
export function union<Vs extends types.Types>(
  variantsGenerators: GeneratorsRecord<Vs>,
): gen.Arbitrary<types.UnionType<Vs>> {
  return orUndefined(unionTypeOptions()).chain((options) => {
    return gen.record(variantsGenerators).map((variants) => {
      return types.union(variants, options)
    })
  })
}

/**
 * @returns A generator for object types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function objectTypeOptions(): gen.Arbitrary<types.OptionsOf<types.ObjectType<any, any>>> {
  return baseOptions()
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated object type
 * @returns a generator for an object type that can either be mutable or immutable
 */
export function object<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.ObjectType<types.Mutability, Ts> | (() => types.ObjectType<types.Mutability, Ts>)> {
  const objectGenerator = gen.oneof(immutableObject(fieldsGenerators), mutableObject(fieldsGenerators))
  const makeLazy = <A>(value: A) => {
    return () => value
  }
  return withChanceOneIn(2, objectGenerator, makeLazy)
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated entity type
 * @returns a generator for an object type that can either be mutable or immutable
 */
export function entity<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.EntityType<types.Mutability, Ts> | (() => types.EntityType<types.Mutability, Ts>)> {
  const objectGenerator = gen.oneof(immutableEntity(fieldsGenerators), mutableEntity(fieldsGenerators))
  const makeLazy = <A>(value: A) => {
    return () => value
  }
  return withChanceOneIn(2, objectGenerator, makeLazy)
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated object type
 * @returns a generator for an immutable object type
 */
export function immutableObject<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.ObjectType<types.Mutability.Immutable, Ts>> {
  return orUndefined(objectTypeOptions()).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.object(fields, options)
    })
  })
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated object type
 * @returns a generator for a mutable object type
 */
export function mutableObject<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.ObjectType<types.Mutability.Mutable, Ts>> {
  return orUndefined(objectTypeOptions()).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.mutableObject(fields, options)
    })
  })
}

/**
 * @returns A generator for entity types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function entityTypeOptions(): gen.Arbitrary<types.OptionsOf<types.EntityType<any, any>>> {
  return baseOptions()
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated entity type
 * @returns a generator for an immutable entity type
 */
export function immutableEntity<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.EntityType<types.Mutability.Immutable, Ts>> {
  return orUndefined(entityTypeOptions()).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.entity(fields, options)
    })
  })
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated entity type
 * @returns a generator for a mutable entity type
 */
export function mutableEntity<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.EntityType<types.Mutability.Mutable, Ts>> {
  return orUndefined(entityTypeOptions()).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.mutableEntity(fields, options)
    })
  })
}

/**
 * @returns A generator for array types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function arrayTypeOptions(): gen.Arbitrary<types.OptionsOf<types.ArrayType<any, any>>> {
  return gen.integer({ min: 0, max: 500 }).chain((min) => {
    return gen.integer({ min, max: 500 }).chain((max) => {
      return gen.record(
        {
          ...baseOptionsGeneratorsRecord(),
          minItems: gen.constant(min),
          maxItems: gen.constant(max),
        },
        {
          withDeletedKeys: true,
        },
      )
    })
  })
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated array type
 * @returns a generator for an array type that could either be mutable or immutable
 */
export function array<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ArrayType<types.Mutability, T>> {
  return gen.oneof(immutableArray(wrappedTypeGenerator), mutableArray(wrappedTypeGenerator))
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated array type
 * @returns a generator for an immutable array type
 */
export function immutableArray<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ArrayType<types.Mutability.Immutable, T>> {
  return orUndefined(arrayTypeOptions()).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.array(wrappedType, options)
    })
  })
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated array type
 * @returns a generator for a mutable array type
 */
export function mutableArray<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ArrayType<types.Mutability.Mutable, T>> {
  return orUndefined(arrayTypeOptions()).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.mutableArray(wrappedType, options)
    })
  })
}

/**
 * @returns A generator for optional types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function optionalTypeOptions(): gen.Arbitrary<types.OptionsOf<types.OptionalType<any>>> {
  return baseOptions()
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated optional type
 * @param defaultValueGenerator an optional generator for the default type to assign to the randomly generated optional
 *        value
 * @returns a generator for optional types
 */
export function optional<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.OptionalType<T>> {
  return orUndefined(optionalTypeOptions()).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.optional(wrappedType, options)
    })
  })
}

/**
 * @returns A generator for nullable types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function nullableTypeOptions(): gen.Arbitrary<types.OptionsOf<types.NullableType<any>>> {
  return baseOptions()
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated nullable type
 * @returns a generator for nullable types
 */
export function nullable<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.NullableType<T>> {
  return orUndefined(nullableTypeOptions()).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.nullable(wrappedType, options)
    })
  })
}

// TODO: add custom type generator

/**
 * @param maxDepth the maximum depth of the generated type
 * @returns a generator for random types
 */
export function type(maxDepth: number = 5): gen.Arbitrary<types.Type> {
  return maxDepth <= 1
    ? baseType()
    : gen.oneof(wrapperType(maxDepth), objectType(maxDepth), entityType(maxDepth), unionType(), baseType())
}

/**
 * Generator for a non empty array of random strings.
 */
function nonEmptyStringArray(): gen.Arbitrary<[string, ...string[]]> {
  return gen.string().chain((first) => {
    return gen.array(gen.string()).map((rest) => {
      return [first, ...rest]
    })
  })
}
/**
 * Generator for values that can be used to create a Literal type.
 */
function literalValue(): gen.Arbitrary<boolean | string | number | null> {
  return gen.oneof(gen.string(), gen.integer(), gen.boolean(), gen.constant(null))
}

/**
 * Generator for base types: numbers, strings, booleans, enumerations and literals.
 */
export function baseType(): gen.Arbitrary<
  | types.NumberType
  | types.StringType
  | types.BooleanType
  | types.EnumType<[string, ...string[]]>
  | types.LiteralType<boolean | string | number | null>
  | types.CustomType<string, any, any>
> {
  return gen.oneof(
    number(),
    string(),
    boolean(),
    enumeration(nonEmptyStringArray()),
    literal(literalValue()),
    dateTime(),
    timestamp(),
    unknown(),
  )
}

/**
 * Generator for wrapper types: reference, optional, nullable and array.
 */
export function wrapperType(
  maxDepth: number = 3,
  wrappedType: gen.Arbitrary<types.Type> = type(maxDepth - 1),
): gen.Arbitrary<
  | types.OptionalType<types.Type>
  | types.NullableType<types.Type>
  | types.RecordType<types.Type>
  | types.ArrayType<types.Mutability, types.Type>
> {
  return gen.oneof(optional(wrappedType), nullable(wrappedType), array(wrappedType), record(wrappedType))
}

/**
 * Generator for a generic object type.
 */
function objectType(maxDepth: number): gen.Arbitrary<types.Type> {
  const fieldName = gen.string().filter((s) => s !== '__proto__' && s !== 'valueOf')
  return gen.dictionary(fieldName, gen.constant(type(maxDepth - 1))).chain(object)
}

/**
 * Generator for a generic object type.
 */
function entityType(maxDepth: number): gen.Arbitrary<types.Type> {
  const fieldName = gen.string().filter((s) => s !== '__proto__' && s !== 'valueOf')
  return gen.dictionary(fieldName, gen.constant(type(maxDepth - 1))).chain(entity)
}

/**
 * Generator for a generic enum type.
 */
function unionType(): gen.Arbitrary<types.Type> {
  return gen
    .dictionary(gen.string(), gen.oneof(gen.constant(number()), gen.constant(boolean())), { minKeys: 1 })
    .chain((variantsGenerators) => {
      return union(variantsGenerators)
    })
}

/**
 * @param chances the number used to determine the chance of transforming the provided generator
 * @param generator the generator to apply the map function to
 * @param map the function that may applied to the values generated by the generator
 * @returns a new generator where, with a chance of 1 in `chances` its generated values will be trasformed
 *          using the provided `map` function
 */
function withChanceOneIn<A, B>(chances: number, generator: gen.Arbitrary<A>, map: (_: A) => B): gen.Arbitrary<A | B> {
  return generator.chain((value) => {
    return gen.integer({ min: 1, max: chances }).map((chance) => {
      return chance === 1 ? map(value) : value
    })
  })
}

/**
 * A record with the same structure as `BaseOptions` but with generators for fields.
 */
function baseOptionsGeneratorsRecord() {
  return {
    name: gen.string(),
    description: gen.string(),
    sensitive: gen.boolean(),
  }
}

/**
 * @param generator a generator for arbitrary values
 * @returns a new generator that may also generate the undefined value
 */
function orUndefined<A>(generator: gen.Arbitrary<A>): gen.Arbitrary<A | undefined> {
  return gen.oneof(gen.constant(undefined), generator)
}

export function typeAndValue(typeDepth: number = 3, valueDepth: number = 3): gen.Arbitrary<[types.Type, never]> {
  return type(typeDepth)
    .filter(canGenerateValueFrom)
    .chain((type) => {
      return types
        .concretise(type)
        .arbitrary(valueDepth)
        .map((value) => {
          return [type, value as never]
        })
    })
}

// TODO: doc
export function canGenerateValueFrom(type: types.Type): boolean {
  // This is just an ugly hack for now but really effective! If the constructor does not throw then I can
  // generate a type for it
  try {
    types.concretise(type).arbitrary(1)
    return true
  } catch {
    return false
  }
}
