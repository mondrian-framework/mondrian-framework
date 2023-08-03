import { fc as gen } from '@fast-check/vitest'
import { types } from '@mondrian-framework/model'

/**
 * Generator for a TypeScript number.
 */
const integerOrFloat = gen.oneof(gen.integer(), gen.float())

/**
 * A record with the same structure as `BaseOptions` but with generators for fields.
 */
const baseOptionsGeneratorsRecord = {
  name: gen.string(),
  description: gen.string(),
}

/**
 * Generator for the inclusivity ("inclusive", "exclusive") of lower and upper bounds.
 */
const inclusivity: gen.Arbitrary<'inclusive' | 'exclusive'> = gen.constantFrom('inclusive', 'exclusive')

/**
 * @param generator a generator for arbitrary values
 * @returns a new generator that may also generate the undefined value
 */
function orUndefined<A>(generator: gen.Arbitrary<A>): gen.Arbitrary<A | undefined> {
  return gen.oneof(gen.constant(undefined), generator)
}

/**
 * A generator for types' base options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const baseOptions: gen.Arbitrary<types.BaseOptions> = gen.record(baseOptionsGeneratorsRecord, {
  withDeletedKeys: true,
})

/**
 * A generator for string types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const stringTypeOptions: gen.Arbitrary<types.OptionsOf<types.StringType>> = gen.record(
  {
    ...baseOptionsGeneratorsRecord,
    // ⚠️ possible pain point: there is no generator for regexes so we only generate two:
    // - a regex that matches any input (https://2ality.com/2012/09/empty-regexp.html)
    // - a regex that matches no input (https://2ality.com/2012/09/empty-regexp.html)
    // For now this is already enough to cover some test cases
    regex: gen.constantFrom(/(?:)/, /.^/),
    maxLength: integerOrFloat,
    minLength: integerOrFloat,
  },
  { withDeletedKeys: true },
)

/**
 * A generator for string types.
 */
export const string: gen.Arbitrary<types.StringType> = orUndefined(stringTypeOptions).map(types.string)

/**
 * A generator for number types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const numberTypeOptions: gen.Arbitrary<types.OptionsOf<types.NumberType>> = gen.record(
  {
    ...baseOptionsGeneratorsRecord,
    minimum: gen.tuple(integerOrFloat, inclusivity),
    maximum: gen.tuple(integerOrFloat, inclusivity),
    multipleOf: integerOrFloat,
  },
  { withDeletedKeys: true },
)

/**
 * A generator for number types.
 */
export const number: gen.Arbitrary<types.NumberType> = orUndefined(numberTypeOptions).map(types.number)

/**
 * A generator for boolean types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const booleanTypeOptions: gen.Arbitrary<types.OptionsOf<types.BooleanType>> = baseOptions

/**
 * A generator for boolean types.
 */
export const boolean: gen.Arbitrary<types.BooleanType> = orUndefined(booleanTypeOptions).map(types.boolean)

/**
 * A generator for literal types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const literalTypeOptions: gen.Arbitrary<types.OptionsOf<types.LiteralType<any>>> = baseOptions

/**
 * @param literalGenerator the generator for the literal value of the randomly generated literal type
 * @returns a generator for a literal type wrapping the given literal
 */
export function literal<L extends number | string | boolean | null>(
  literalGenerator: gen.Arbitrary<L>,
): gen.Arbitrary<types.LiteralType<L>> {
  return orUndefined(literalTypeOptions).chain((options) => {
    return literalGenerator.map((literalValue) => {
      return types.literal(literalValue, options)
    })
  })
}

/**
 * A generator for enum types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const enumTypeOptions: gen.Arbitrary<types.OptionsOf<types.EnumType<any>>> = baseOptions

/**
 * @param variantsGenerator the generator for the variants of the randomly generated enum type
 * @returns a generator for an enum type wrapping the given variants
 */
export function enumeration<Vs extends readonly [string, ...string[]]>(
  variantsGenerator: gen.Arbitrary<Vs>,
): gen.Arbitrary<types.EnumType<Vs>> {
  return orUndefined(enumTypeOptions).chain((options) => {
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
 * A generator for union types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const unionTypeOptions: gen.Arbitrary<types.OptionsOf<types.UnionType<any>>> = baseOptions

/**
 * @param variantsGenerators a generator for the variants of the randomly generated union type
 * @returns a generator for a union type
 */
export function union<Vs extends types.Types>(
  variantsGenerators: GeneratorsRecord<Vs>,
  variantsChecks?: { [Key in keyof Vs]: (_: types.Infer<types.UnionType<Vs>>) => boolean },
): gen.Arbitrary<types.UnionType<Vs>> {
  return orUndefined(unionTypeOptions).chain((options) => {
    return gen.record(variantsGenerators).map((variants) => {
      return types.union(variants, variantsChecks, options)
    })
  })
}

/**
 * A generator for object types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const objectTypeOptions: gen.Arbitrary<types.OptionsOf<types.ObjectType<any, any>>> = baseOptions

/**
 * @param fieldsGenerators a generator for the fields of the randomly generated object type
 * @returns a generator for an object type
 */
export function object<Ts extends types.Types>(
  fieldsGenerators: GeneratorsRecord<Ts>,
): gen.Arbitrary<types.ObjectType<'immutable', Ts>> {
  return orUndefined(objectTypeOptions).chain((options) => {
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
  return orUndefined(objectTypeOptions).chain((options) => {
    return gen.record(fieldsGenerators).map((fields) => {
      return types.mutableObject(fields, options)
    })
  })
}

/**
 * A generator for array types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const arrayTypeOptions: gen.Arbitrary<types.OptionsOf<types.ArrayType<any, any>>> = gen.record(
  {
    ...baseOptionsGeneratorsRecord,
    minItems: integerOrFloat,
    maxItems: integerOrFloat,
  },
  {
    withDeletedKeys: true,
  },
)

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated array type
 * @returns a generator for an immutable array type
 */
export function array<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ArrayType<'immutable', T>> {
  return orUndefined(arrayTypeOptions).chain((options) => {
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
  return orUndefined(arrayTypeOptions).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.mutableArray(wrappedType, options)
    })
  })
}

/**
 * A generator for optional types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const optionalTypeOptions: gen.Arbitrary<types.OptionsOf<types.OptionalType<any>>> = baseOptions

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
  return orUndefined(optionalTypeOptions).chain((options) => {
    return orUndefined(actualDefaultValueGenerator).chain((defaultValue) => {
      return wrappedTypeGenerator.map((wrappedType) => {
        return types.optional(wrappedType, defaultValue, options)
      })
    })
  })
}

/**
 * A generator for nullable types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const nullableTypeOptions: gen.Arbitrary<types.OptionsOf<types.NullableType<any>>> = baseOptions

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated nullable type
 * @returns a generator for nullable types
 */
export function nullable<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.NullableType<T>> {
  return orUndefined(nullableTypeOptions).chain((options) => {
    return wrappedTypeGenerator.map((wrappedType) => {
      return types.nullable(wrappedType, options)
    })
  })
}

/**
 * A generator for reference types' options.
 * All of its keys are optional and may be omitted in the generated options.
 */
export const referenceTypeOptions: gen.Arbitrary<types.OptionsOf<types.ReferenceType<any>>> = baseOptions

/**
 * @param wrappedTypeGenerator a generator for the type wrapped by the randomly generated reference type
 * @returns a generator for nullable types
 */
export function reference<T extends types.Type>(
  wrappedTypeGenerator: gen.Arbitrary<T>,
): gen.Arbitrary<types.ReferenceType<T>> {
  return orUndefined(referenceTypeOptions).chain((options) => {
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
    maxDepth <= 1 ? baseType : gen.oneof(wrapperType(maxDepth), objectType(maxDepth), unionType(maxDepth), baseType)
  const turnIntoLazyType = (type: types.Type) => () => type
  return withChanceOneIn(12, generatedType, turnIntoLazyType)
}

/**
 * Generator for a non empty array of random strings.
 */
const nonEmptyStringArray: gen.Arbitrary<[string, ...string[]]> = gen
  .string()
  .chain((first) => gen.array(gen.string()).map((rest) => [first, ...rest]))

/**
 * Generator for values that can be used to create a Literal type.
 */
const literalValue: gen.Arbitrary<boolean | string | number | null> = gen.oneof(
  gen.string(),
  gen.integer(),
  gen.boolean(),
  gen.constant(null),
)

/**
 * Generator for base types: numbers, strings, booleans, enumerations and literals.
 */
const baseType: gen.Arbitrary<types.Type> = gen.oneof(
  number,
  string,
  boolean,
  enumeration(nonEmptyStringArray),
  literal(literalValue),
)

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
