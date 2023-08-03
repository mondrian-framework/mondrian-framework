import { fc as gen } from '@fast-check/vitest'
import { types } from '@mondrian-framework/model'

/**
 * Generator for a TypeScript number.
 */
function integerOrFloat(): gen.Arbitrary<number> {
  return gen.oneof(gen.integer(), gen.float())
}

/**
 * A record with the same structure as `BaseOptions` but with generators for fields.
 */
function baseOptionsGeneratorsRecord() {
  return {
    name: gen.string(),
    description: gen.string(),
  }
}

/**
 * Generator for the inclusivity ("inclusive", "exclusive") of lower and upper bounds.
 */
function inclusivity(): gen.Arbitrary<'inclusive' | 'exclusive'> {
  return gen.constantFrom('inclusive', 'exclusive')
}

/**
 * @param generator a generator for arbitrary values
 * @returns a new generator that may also generate the undefined value
 */
function orUndefined<A>(generator: gen.Arbitrary<A>): gen.Arbitrary<A | undefined> {
  return gen.oneof(gen.constant(undefined), generator)
}

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
  return gen.record(
    {
      ...baseOptionsGeneratorsRecord(),
      // ⚠️ possible pain point: there is no generator for regexes so we only generate two:
      // - a regex that matches any input (https://2ality.com/2012/09/empty-regexp.html)
      // - a regex that matches no input (https://2ality.com/2012/09/empty-regexp.html)
      // For now this is already enough to cover some test cases
      regex: gen.constantFrom(/(?:)/, /.^/),
      maxLength: integerOrFloat(),
      minLength: integerOrFloat(),
    },
    { withDeletedKeys: true },
  )
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
  return gen.record(
    {
      ...baseOptionsGeneratorsRecord(),
      minimum: integerOrFloat(),
      exclusiveMinimum: integerOrFloat(),
      maximum: integerOrFloat(),
      exclusiveMaximum: integerOrFloat(),
      multipleOf: integerOrFloat(),
    },
    { withDeletedKeys: true },
  )
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
  return baseOptions()
}

/**
 * @param variantsGenerators a generator for the variants of the randomly generated union type
 * @returns a generator for a union type
 */
export function union<Vs extends types.Types>(
  variantsGenerators: GeneratorsRecord<Vs>,
  variantsChecks?: { [Key in keyof Vs]: (_: types.Infer<types.UnionType<Vs>>) => boolean },
): gen.Arbitrary<types.UnionType<Vs>> {
  return orUndefined(unionTypeOptions()).chain((options) => {
    return gen.record(variantsGenerators).map((variants) => {
      return types.union(variants, variantsChecks, options)
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
 * @returns a generator for an object type
 */
export function object<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.ObjectType<'immutable', Ts>> {
  return orUndefined(objectTypeOptions()).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.object(fields, options)
    })
  })
}

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated object type
 * @returns a generator for an object type
 */
export function mutableObject<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.ObjectType<'mutable', Ts>> {
  return orUndefined(objectTypeOptions()).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.mutableObject(fields, options)
    })
  })
}

/**
 * @returns A generator for array types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function arrayTypeOptions(): gen.Arbitrary<types.OptionsOf<types.ArrayType<any, any>>> {
  return gen.record(
    {
      ...baseOptionsGeneratorsRecord(),
      minItems: integerOrFloat(),
      maxItems: integerOrFloat(),
    },
    {
      withDeletedKeys: true,
    },
  )
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated array type
 * @returns a generator for an immutable array type
 */
export function array<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ArrayType<'immutable', T>> {
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
): gen.Arbitrary<types.ArrayType<'mutable', T>> {
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
  defaultValueGenerator?: gen.Arbitrary<types.Infer<T> | (() => types.Infer<T>)>,
): gen.Arbitrary<types.OptionalType<T>> {
  const actualDefaultValueGenerator = defaultValueGenerator ?? gen.constant(undefined)
  return orUndefined(optionalTypeOptions()).chain((options) => {
    return orUndefined(actualDefaultValueGenerator).chain((defaultValue) => {
      return wrappedTypeGenerator.map((wrappedType) => {
        return types.optional(wrappedType, defaultValue, options)
      })
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

/**
 * @returns A generator for reference types' options.
 *          All of its keys are optional and may be omitted in the generated options.
 */
export function referenceTypeOptions(): gen.Arbitrary<types.OptionsOf<types.ReferenceType<any>>> {
  return baseOptions()
}

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated reference type
 * @returns a generator for nullable types
 */
export function reference<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ReferenceType<T>> {
  return orUndefined(referenceTypeOptions()).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.reference(wrappedType, options)
    })
  })
}

// TODO: add custom type generator

/**
 * @param maxDepth the maximum depth of the generated type
 * @returns a generator for random types
 */
export function type(maxDepth: number = 5): gen.Arbitrary<types.Type> {
  const generatedType =
    maxDepth <= 1 ? baseType() : gen.oneof(wrapperType(maxDepth), objectType(maxDepth), unionType(maxDepth), baseType())
  const turnIntoLazyType = (type: types.Type) => () => type
  return withChanceOneIn(12, generatedType, turnIntoLazyType)
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
function baseType(): gen.Arbitrary<types.Type> {
  return gen.oneof(number(), string(), boolean(), enumeration(nonEmptyStringArray()), literal(literalValue()))
}

/**
 * Generator for wrapper types: reference, optional, nullable and array.
 */
function wrapperType(maxDepth: number): gen.Arbitrary<types.Type> {
  const wrappedType = type(maxDepth - 1)
  // ⚠️ Possible pain point: here we never generate the default for the optional type so it may never cover some
  // test cases. TODO: We should fin a way to generate that, maybe it's already possible but I haven't lookd into it!
  return gen.oneof(reference(wrappedType), optional(wrappedType), nullable(wrappedType), array(wrappedType))
}

/**
 * Generator for a generic object type.
 */
function objectType(maxDepth: number): gen.Arbitrary<types.Type> {
  const fieldsGenerator = gen.dictionary(gen.string(), type(maxDepth - 1))
  return gen.oneof(object(fieldsGenerator as any), mutableObject(fieldsGenerator as any))
}

/**
 * Generator for a generic enum type.
 */
function unionType(maxDepth: number): gen.Arbitrary<types.Type> {
  const variantsGenerator = gen.dictionary(gen.string(), type(maxDepth - 1))
  return union(variantsGenerator as any)
}

/**
 * @param chances the number used to determine the chance of transforming the provided generator
 * @param generator the generator to apply the map function to
 * @param map the function that may applied to the values generated by the generator
 * @returns a new generator where, with a chance of 1 in `chances` its generated values will be trasformed
 *          using the provided `map` function
 */
function withChanceOneIn<A>(chances: number, generator: gen.Arbitrary<A>, map: (_: A) => A): gen.Arbitrary<A> {
  return generator.chain((value) => {
    return gen.integer({ min: 1, max: chances }).map((chance) => {
      return chance === 1 ? map(value) : value
    })
  })
}
