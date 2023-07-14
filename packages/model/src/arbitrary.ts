import {
  NumberTypeOptions,
  NumberType,
  number,
  StringTypeOptions,
  StringType,
  string,
  BooleanTypeOptions,
  BooleanType,
  boolean,
  EnumTypeOptions,
  EnumType,
  LiteralTypeOptions,
  LiteralType,
  UnionTypeOptions,
  UnionType,
  ObjectTypeOptions,
  ObjectType,
  ArrayTypeOptions,
  ArrayType,
  NullableTypeOptions,
  NullableType,
  OptionalTypeOptions,
  OptionalType,
  ReferenceTypeOptions,
  ReferenceType,
  BaseOptions,
} from './type-system'
import { fc as gen } from '@fast-check/vitest'

/**
 * Turns an object type into another type where each field is a generator for values of the type of that field.
 * @example ```ts
 *          type Gen = ObjectToGenerators<{ name: string, age?: number }>
 *          // -> Gen = { name: Arbitrary<string>, age?: Arbitrary<number> | undefined }
 *          ```
 */
type ObjectToGenerators<R extends Record<any, any>> = { [Key in keyof R]: gen.Arbitrary<NonNullable<R[Key]>> }

/**
 * A generator for inclusivity annotations: "inclusive" or "exclusive".
 */
const inclusivity: gen.Arbitrary<'inclusive' | 'exclusive'> = gen.oneof(
  gen.constant('inclusive') as gen.Arbitrary<'inclusive'>,
  gen.constant('exclusive') as gen.Arbitrary<'exclusive'>,
)

/**
 * A generator for arbitrary numbers, both integers and floating points.
 */
const arbitraryNumber: gen.Arbitrary<number> = gen.oneof(gen.float(), gen.integer())

/**
 * An object with generators for the fields of base options
 */
const baseOptionsGenerators: ObjectToGenerators<BaseOptions> = {
  name: gen.string(),
  description: gen.string(),
}

/**
 * @param generators an object of generators that can be used to override the default generators
 * @returns a generator of {@link NumberTypeOptions `NumberTypeOptions`}
 */
export function numberTypeOptions(
  generators?: ObjectToGenerators<NumberTypeOptions>,
): gen.Arbitrary<NumberTypeOptions> {
  const actualGenerators = {
    ...baseOptionsGenerators,
    maximum: gen.tuple(arbitraryNumber, inclusivity),
    minimum: gen.tuple(arbitraryNumber, inclusivity),
    multipleOf: arbitraryNumber,
    ...(generators ? generators : {}),
  }
  return gen.record(actualGenerators, { requiredKeys: [] })
}

/**
 * @param generators an object of generators that can be used to override the default generators used to create the
 *                   `NumberType` {@link NumberTypeOptions options}
 * @returns a generator of {@link NumberType `NumberType`}
 */
export function numberType(generators?: ObjectToGenerators<NumberTypeOptions>): gen.Arbitrary<NumberType> {
  return numberTypeOptions(generators).map(number)
}

/**
 * @param generators an object of generators that can be used to override the default generators
 * @returns a generator of {@link NumberTypeOptions `NumberTypeOptions`}
 */
export function stringTypeOptions(
  generators?: ObjectToGenerators<StringTypeOptions>,
): gen.Arbitrary<StringTypeOptions> {
  const actualGenerators = {
    ...baseOptionsGenerators,
    maxLength: gen.integer(),
    minLength: gen.integer(),
    regex: gen.constant(/.*/),
    ...(generators ? generators : {}),
  }
  return gen.record(actualGenerators, { requiredKeys: [] })
}

/**
 * @param generators an object of generators that can be used to override the default generators used to create the
 *                   `StringType` {@link StringTypeOptions options}
 * @returns a generator of {@link StringType `StringType`}
 */
export function stringType(generators?: ObjectToGenerators<StringTypeOptions>): gen.Arbitrary<StringType> {
  return stringTypeOptions(generators).map(string)
}

/**
 * @param generators an object of generators that can be used to override the default generators
 * @returns a generator of {@link BooleanTypeOptions `BooleanTypeOptions`}
 */
export function booleanTypeOptions(
  generators?: ObjectToGenerators<BooleanTypeOptions>,
): gen.Arbitrary<BooleanTypeOptions> {
  const actualGenerators = {
    ...baseOptionsGenerators,
    ...generators,
  }
  return gen.record(actualGenerators, { requiredKeys: [] })
}

/**
 * @param generators an object of generators that can be used to override the default generators used to create the
 *                   `BooleanType` {@link BooleanTypeOptions options}
 * @returns a generator of {@link BooleanType `BooleanType`}
 */
export function booleanType(generators?: ObjectToGenerators<BooleanTypeOptions>): gen.Arbitrary<BooleanType> {
  return booleanTypeOptions(generators).map(boolean)
}

/*
// TODO: complete the Arbitrary generators for other types

export function enumTypeOptions(): gen.Arbitrary<EnumTypeOptions> {}
export function enumType(): gen.Arbitrary<EnumType> {}

export function literalTypeOptions(): gen.Arbitrary<LiteralTypeOptions> {}
export function literalType(): gen.Arbitrary<LiteralType<null>> {}

export function unionTypeOptions(): gen.Arbitrary<UnionTypeOptions> {}
export function unionType(): gen.Arbitrary<UnionType<'a'>> {}

export function objectTypeOptions(): gen.Arbitrary<ObjectTypeOptions> {}
export function objectType(): gen.Arbitrary<ObjectType<'a'>> {}

export function arrayTypeOptions(): gen.Arbitrary<ArrayTypeOptions> {}
export function arrayType(): gen.Arbitrary<ArrayType<T>> {}

export function optionalTypeOptions(): gen.Arbitrary<OptionalTypeOptions> {}
export function optionalType(): gen.Arbitrary<OptionalType<T>> {}

export function nullableTypeOptions(): gen.Arbitrary<NullableTypeOptions> {}
export function nullableType(): gen.Arbitrary<NullableType<T>> {}

export function defaultTypeOptions(): gen.Arbitrary<DefaultTypeOptions> {}
export function defaultType(): gen.Arbitrary<DefaultType<T>> {}

export function referenceTypeOptions(): gen.Arbitrary<ReferenceTypeOptions> {}
export function referenceType(): gen.Arbitrary<ReferenceType<T>> {}
*/
