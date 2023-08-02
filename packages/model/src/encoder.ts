import { types, encoder, validator, result } from './index'
import { filterMapObject } from './utils'
import { JSONType } from '@mondrian-framework/utils'
import { match } from 'ts-pattern'

/**
 * @param type the {@link Type type} of the value to encode
 * @param value the value to encode to a `JSONType`
 * @returns a {@link JSONType `JSONType`} encoding of the given `value`
 */
export function encode<const T extends types.Type>(type: T, value: types.Infer<T>): JSONType {
  const encoded = unsafeEncode(type, value)
  // If we get an `undefined` here it means that we where asked to encode an `OptionalType` with the
  // `undefined` value. Since `undefined` is not a valid JSONType we decide to encode it as `null`.
  // It is important that the matching decoder treats a `null` as an `undefined` optional type when
  // decoding optionals!
  return encoded === undefined ? null : encoded
}

export function validateAndEncode<const T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  validationOptions?: Partial<validator.Options>,
): result.Result<JSONType, validator.Error[]> {
  return validator.validate(type, value, validationOptions).replace(encoder.encode(type, value))
}

/**
 * Encodes a value of the type described by `type`. This function is unsafe since no check is performed that the given
 * `value` actually has the type that can be inferred from `type`.
 */
function unsafeEncode(type: types.Type, value: any): JSONType | undefined {
  return match(types.concretise(type))
    .with({ kind: 'boolean' }, () => value)
    .with({ kind: 'number' }, () => value)
    .with({ kind: 'string' }, () => value)
    .with({ kind: 'enum' }, () => value)
    .with({ kind: 'literal' }, (type) => type.literalValue)
    .with({ kind: 'optional' }, (type) => unsafeEncodeOptional(type, value))
    .with({ kind: 'nullable' }, (type) => unsafeEncodeNullable(type, value))
    .with({ kind: 'union' }, (type) => unsafeEncodeUnion(type, value))
    .with({ kind: 'object' }, (type) => unsafeEncodeObject(type, value))
    .with({ kind: 'array' }, (type) => unsafeEncodeArray(type, value))
    .with({ kind: 'reference' }, (type) => unsafeEncodeReference(type, value))
    .with({ kind: 'custom' }, (type) => type.encode(value, type.options))
    .exhaustive()
}

/**
 * Encodes an optional type: if the value is undefined and it doesn't have a default value it returns `undefined`,
 * otherwise it encodes `value` (or the default value if `value` is `undefined`).
 */
function unsafeEncodeOptional<T extends types.Type>(
  type: types.OptionalType<T>,
  value: any | undefined,
): JSONType | undefined {
  const valueToEncode = value ?? type.defaultValue
  return valueToEncode === undefined ? undefined : unsafeEncode(type.wrappedType, valueToEncode)
}

/**
 * Encodes a nullable type: if the value is null it returns null, otherwise encodes it recursively
 * using the encoding strategy defined by the wrapped type.
 */
function unsafeEncodeNullable<T extends types.Type>(
  type: types.NullableType<T>,
  value: any | null,
): JSONType | undefined {
  return value === null ? null : unsafeEncode(type.wrappedType, value)
}

/**
 * Encodes a union type: `union` is encoded with the strategy described by the type of the first variant whose checker
 * matches with it.
 */
function unsafeEncodeUnion<Ts extends types.Types>(type: types.UnionType<Ts>, union: any): JSONType | undefined {
  for (const [variantName, variantType] of Object.entries(type.variants)) {
    // If the object is well typed this check should never fail since the checks always
    // have a field for each of the variant's names
    const isVariant = type.variantsChecks?.[variantName]!
    if (isVariant(union)) {
      return unsafeEncode(variantType, union)
    }
  }
  throw Error(`I could not encode a variant of a union type since none of the checking functions matched with it
variant: ${union}
type: ${type}`)
}

/**
 * Encodes an object type: each of its fields is encoded with the encoding strategy defined by its type.
 * If the result of the encoding of a field is `undefined` it is not added to the final object.
 */
function unsafeEncodeObject<Ts extends types.Types, M extends types.Mutability>(
  type: types.ObjectType<M, Ts>,
  object: any,
): JSONType {
  return filterMapObject(type.types, (fieldName, fieldType) => unsafeEncode(fieldType, object[fieldName]))
}

/**
 * Encodes an array type: each item in `values` is encoded using the strategy defined by the wrapped type.
 */
function unsafeEncodeArray<T extends types.Type, M extends types.Mutability>(
  type: types.ArrayType<M, T>,
  values: any,
): JSONType[] {
  return values.map((value: any) => unsafeEncode(type.wrappedType, value))
}

/**
 * Encodes a reference type: it encodes the value with the encoding strategy defined by the wrapped type.
 */
function unsafeEncodeReference<T extends types.Type>(
  type: types.ReferenceType<T>,
  reference: any,
): JSONType | undefined {
  return unsafeEncode(type.wrappedType, reference)
}
