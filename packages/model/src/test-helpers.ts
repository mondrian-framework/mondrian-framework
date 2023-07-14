import { decode } from './decoder'
import { encode } from './encoder'
import { Type } from './type-system'
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
import { fc as gen, test } from '@fast-check/vitest'
import { SuiteFactory, expect } from 'vitest'

/**
 * This function can be used to test a type provided generators and arrays of valid and invalid values.
 * It will check that valid values can be decoded while invalid ones cannot.
 *
 * It also checks that the encoding and decoding process are one the inverse of the other for valid types.
 *
 * @param type the type to test
 * @param rawValidValues a generator for values that can be decoded successfully to a value of the given `type`
 * @param rawInvalidValues a generator for values that cannot be decoded to a value of the given `type`
 * @param knownValidValues an array of valid values you want to make sure are tested to pass decoding
 * @param knownInvalidValues an array of invalid values you want to make sure are tested to fail decoding
 */
export function testTypeEncodingAndDecoding<T extends Type>(
  type: T,
  generators: {
    validValues?: gen.Arbitrary<unknown>
    invalidValues?: gen.Arbitrary<unknown>
    knownValidValues?: unknown[]
    knownInvalidValues?: unknown[]
  },
): SuiteFactory<{}> {
  return () => {
    const { invalidValues, validValues, knownInvalidValues, knownValidValues } = generators

    const checkInverse = async (rawValue: unknown) => {
      const decoded = decode(type, rawValue)
      if (!decoded.success) {
        expect.fail('decoding a valid value should have succeded')
      }

      const encoded = encode(type, decoded.value)
      expect(encoded).toEqual(rawValue)

      const decodedAgain = decode(type, encoded)
      expect(decodedAgain).toEqual({ success: true, value: rawValue })
    }

    const checkSucceeds = async (rawValue: unknown) =>
      expect(decode(type, rawValue)).toEqual({ success: true, value: rawValue })

    const checkFails = async (rawValue: unknown) =>
      decode(type, rawValue).success ? expect.fail(`${rawValue} was decoded but I expected the decoding to fail`) : true

    if (validValues) {
      test.prop([validValues])('decoding pass for a generated valid value', checkSucceeds)
      test.prop([validValues])('encoding and decoding are inverses for generated valid values', checkInverse)
    }

    if (knownValidValues) {
      test('decoding pass for known valid values', async () => knownValidValues.forEach(checkSucceeds))
      test('encoding and decoding are inverses for known valid values', async () =>
        knownValidValues.forEach(checkInverse))
    }

    if (invalidValues) {
      test.prop([invalidValues])('decoding fails for a generated invalid value', checkFails)
    }

    if (knownInvalidValues) {
      test('decoding fails for known invalid values', async () => knownInvalidValues.forEach(checkFails))
    }
  }
}

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
