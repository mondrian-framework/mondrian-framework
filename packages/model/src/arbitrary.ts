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
  concretise,
  Type,
  Infer,
} from './type-system'
import { fc as gen } from '@fast-check/vitest'
import { match } from 'ts-pattern'

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

export function getArbitrary<T extends Type>(type: T, maxDepth: number = 5): gen.Arbitrary<Infer<T>> {
  const value = match(concretise(type))
    .with({ kind: 'boolean' }, (_type) => gen.boolean())
    .with({ kind: 'number' }, (type) => {
      const multipleOf = type.options?.multipleOf
      if (multipleOf) {
        const [min, minInclusive] = type.options.minimum ?? [undefined, 'inclusive']
        const [max, maxInclusive] = type.options.maximum ?? [undefined, 'inclusive']
        let minIndex = min != null ? Math.round(min / multipleOf + (0.5 - Number.EPSILON)) : undefined
        let maxIndex = max != null ? Math.round(max / multipleOf - (0.5 - Number.EPSILON)) : undefined
        if (maxIndex != null && maxInclusive === 'exclusive' && maxIndex * multipleOf === max) {
          maxIndex--
        }
        if (minIndex != null && minInclusive === 'exclusive' && minIndex * multipleOf === min) {
          minIndex++
        }
        return gen.integer({ min: minIndex, max: maxIndex }).map((v) => v * multipleOf)
      }
      return gen.double({ min: type.options?.minimum?.[0], max: type.options?.maximum?.[0] })
    })
    .with({ kind: 'string' }, (type) =>
      type.options?.regex
        ? gen.stringMatching(type.options.regex).filter((s) => {
            if (type.options?.maxLength && s.length > type.options.maxLength) {
              return false
            }
            if (type.options?.minLength && s.length < type.options.minLength) {
              return false
            }
            return true
          })
        : gen.string({ maxLength: type.options?.maxLength, minLength: type.options?.minLength }),
    )
    .with({ kind: 'literal' }, (type) => gen.stringMatching(type.literalValue))
    .with({ kind: 'enum' }, (type) => gen.oneof(type.variants.map(gen.constant)))
    .with({ kind: 'optional' }, (type) =>
      maxDepth <= 1
        ? gen.constant(undefined)
        : gen.oneof(gen.constant(undefined), getArbitrary(type.wrappedType, maxDepth - 1)),
    )
    .with({ kind: 'nullable' }, (type) =>
      maxDepth <= 1 ? gen.constant(null) : gen.oneof(gen.constant(null), getArbitrary(type.wrappedType, maxDepth - 1)),
    )
    .with({ kind: 'union' }, (type) =>
      gen.oneof(...Object.values(type.variants).map((v) => getArbitrary(v as Type, maxDepth - 1))),
    )
    .with({ kind: 'object' }, (type) =>
      gen.record(
        Object.fromEntries(Object.entries(type.types).map(([k, st]) => [k, getArbitrary(st as Type, maxDepth - 1)])),
      ),
    )
    .with({ kind: 'array' }, (type) =>
      maxDepth <= 1 && (type.options?.minItems ?? 0) <= 0
        ? gen.constant([])
        : gen.array(getArbitrary(type.wrappedType, maxDepth - 1), {
            maxLength: type.options?.maxItems,
            minLength: type.options?.minItems,
          }),
    )
    .with({ kind: 'reference' }, (type) => getArbitrary(type.wrappedType, maxDepth - 1))
    .with({ kind: 'custom' }, (type) => type.arbitrary)
    .exhaustive()

  return value as gen.Arbitrary<Infer<T>>
}
