import { types, encoder, validator, result } from './index'
import { assertNever, failWithInternalError, filterMapObject } from './utils'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param type the {@link Type type} of the value to encode
 * @param value the value to encode to a `JSONType`
 * @returns a {@link JSONType `JSONType`} encoding of the given `value`
 */
export function encodeWithoutValidation<const T extends types.Type>(type: T, value: types.Infer<T>): JSONType {
  const encoded = unsafeEncode(type, value)
  // If we get an `undefined` here it means that we where asked to encode an `OptionalType` with the
  // `undefined` value. Since `undefined` is not a valid JSONType we decide to encode it as `null`.
  // It is important that the matching decoder treats a `null` as an `undefined` optional type when
  // decoding optionals!
  return encoded === undefined ? null : encoded
}

/**
 * TODO: add doc
 * @param type
 * @param value
 * @param validationOptions
 * @returns
 */
export function encode<const T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  validationOptions?: Partial<validator.Options>,
): result.Result<JSONType, validator.Error[]> {
  return validator.validate(type, value, validationOptions).replace(encoder.encodeWithoutValidation(type, value))
}

/**
 * Encodes a value of the type described by `type`. This function is unsafe since no check is performed that the given
 * `value` actually has the type that can be inferred from `type`.
 */
function unsafeEncode(type: types.Type, value: any): JSONType | undefined {
  const concreteType = types.concretise(type)
  if (concreteType.kind === 'boolean') {
    return value
  } else if (concreteType.kind === 'number') {
    return value
  } else if (concreteType.kind === 'string') {
    return value
  } else if (concreteType.kind === 'enum') {
    return value
  } else if (concreteType.kind === 'literal') {
    return concreteType.literalValue
  } else if (concreteType.kind === 'optional') {
    return unsafeEncodeOptional(concreteType, value)
  } else if (concreteType.kind === 'nullable') {
    return unsafeEncodeNullable(concreteType, value)
  } else if (concreteType.kind === 'union') {
    return unsafeEncodeUnion(concreteType, value)
  } else if (concreteType.kind === 'object') {
    return unsafeEncodeObject(concreteType, value)
  } else if (concreteType.kind === 'array') {
    return unsafeEncodeArray(concreteType, value)
  } else if (concreteType.kind === 'reference') {
    return unsafeEncodeReference(concreteType, value)
  } else if (concreteType.kind === 'custom') {
    return concreteType.encode(value, concreteType.options)
  } else {
    assertNever(concreteType, 'Totality check failed when unsafe encoding a value, this should have never happened')
  }
}

/**
 * Encodes an optional type: if the value is undefined and it doesn't have a default value it returns `undefined`,
 * otherwise it encodes `value` (or the default value if `value` is `undefined`).
 */
function unsafeEncodeOptional<T extends types.Type>(
  type: types.OptionalType<T>,
  value: any | undefined,
): JSONType | undefined {
  return value === undefined ? undefined : unsafeEncode(type.wrappedType, value)
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
  const failureMessage =
    'I tried to encode an object that is not a variant as a union. This should have been prevented by the type system'
  const variantName = Object.keys(union).at(0)
  if (variantName === undefined) {
    failWithInternalError(failureMessage)
  } else {
    const variantType = type.variants[variantName]
    if (variantType === undefined) {
      failWithInternalError(failureMessage)
    } else {
      const encoded = unsafeEncode(variantType, union[variantName]) ?? null
      return Object.fromEntries([[variantName, encoded]])
    }
  }
}

/**
 * Encodes an object type: each of its fields is encoded with the encoding strategy defined by its type.
 * If the result of the encoding of a field is `undefined` it is not added to the final object.
 */
function unsafeEncodeObject<Ts extends types.Types, M extends types.Mutability>(
  type: types.ObjectType<M, Ts>,
  object: any,
): JSONType {
  return filterMapObject(type.fields, (fieldName, fieldType) => unsafeEncode(fieldType, object[fieldName]))
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
