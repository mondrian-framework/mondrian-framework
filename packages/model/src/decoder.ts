import { Error, Result, Success, concat2, enrichErrors, error, errors, richError, success } from './result'
import {
  Infer,
  Type,
  ObjectType,
  concretise,
  OptionalType,
  LiteralType,
  NullableType,
  ReferenceType,
  ArrayType,
  EnumType,
  UnionType,
} from './type-system'
import { containsKey } from './utils'
import { match, Pattern as P } from 'ts-pattern'

/**
 * The options that can be used when decoding a type.
 * TODO: SEE IF I NEED TO VALIDATE WHEN DECODING!!!!
 */
export type DecodingOptions = {
  typeCastingStrategy: TypeCastingStrategy
  errorReportingStrategy: ErrorReportingStrategy
  unionDecodingStrategy: UnionDecodingStrategy
}

/**
 * Determines how the decoding process behaves when decoding a type:
 * - `"expectExactTypes"`: means that the decoder will not try to perform any casting. It will always expect to find the
 *   exact specified value
 * - `"tryCasting"`: means that the decoder will try to perform some casts before giving up in the decoding process.
 *   For example, if the decoder incurs in a number and was trying to decode a boolean, it will turn the number into a
 *   `boolean`
 */
export type TypeCastingStrategy = 'tryCasting' | 'expectExactTypes'

/**
 * TODO: ADD DOC
 */
export type ErrorReportingStrategy = 'allErrors' | 'stopAtFirstError'

/**
 * TODO: ADD DOC
 */
export type UnionDecodingStrategy = 'taggedUnions' | 'untaggedUnions'

/**
 * The default recommended options to be used in the decoding process.
 */
const defaultDecodingOptions: DecodingOptions = {
  typeCastingStrategy: 'expectExactTypes',
  errorReportingStrategy: 'stopAtFirstError',
  unionDecodingStrategy: 'untaggedUnions',
}

export function decode<T extends Type>(type: T, value: unknown, options?: DecodingOptions): Result<Infer<T>> {
  const actualOptions = options ?? defaultDecodingOptions
  const result = unsafeDecode(type, value, actualOptions) as Result<Infer<T>>
  return enrichErrors(result)
}

function unsafeDecode(type: Type, value: unknown, options: DecodingOptions): Result<unknown> {
  return match(concretise(type))
    .with({ kind: 'boolean' }, (_type) => decodeBoolean(value, options))
    .with({ kind: 'number' }, (_type) => decodeNumber(value, options))
    .with({ kind: 'string' }, (_type) => decodeString(value, options))
    .with({ kind: 'literal' }, (type) => decodeLiteral(type, value, options))
    .with({ kind: 'enum' }, (type) => decodeEnum(type, value))
    .with({ kind: 'optional' }, (type) => decodeOptional(type, value, options))
    .with({ kind: 'nullable' }, (type) => decodeNullable(type, value, options))
    .with({ kind: 'union' }, (type) => decodeUnion(type, value, options))
    .with({ kind: 'object' }, (type) => decodeObject(type, value, options))
    .with({ kind: 'array' }, (type) => decodeArray(type, value, options))
    .with({ kind: 'reference' }, (type) => decodeReference(type, value, options))
    .exhaustive()
}

/**
 * Tries to decode a boolean value.
 */
function decodeBoolean(value: unknown, options: DecodingOptions): Result<boolean> {
  return match([options.typeCastingStrategy, value])
    .with([P._, true], () => success(true))
    .with([P._, false], () => success(false))
    .with(['tryCasting', 'true'], () => success(true))
    .with(['tryCasting', 'false'], () => success(false))
    .with(['tryCasting', P.number], ([_, n]) => success(n !== 0))
    .otherwise((_) => error('Expected a boolean', value))
}

/**
 * Tries to decode a number value.
 */
function decodeNumber(value: unknown, options: DecodingOptions): Result<number> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.number], ([_, n]) => success(n))
    .with(['tryCasting', P.string], ([_, s]) => numberFromString(s))
    .otherwise((_) => error('Expected a number', value))
}

function numberFromString(string: string): Result<number> {
  return match(Number(string))
    .with(NaN, (_) => error('Expected a number', string))
    .with(P.number, (n) => success(n))
    .exhaustive()
}

/**
 * Tries to decode a string value.
 */
function decodeString(value: unknown, options: DecodingOptions): Result<string> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.string], ([_, s]) => success(s))
    .with(['tryCasting', P.number], ([_, n]) => success(n.toString()))
    .with(['tryCasting', P.boolean], ([_, b]) => success(b.toString()))
    .otherwise((_) => error('Expected a string', value))
}

/**
 * Tries to decode a literal value.
 */
function decodeLiteral(type: LiteralType<any>, value: unknown, options: DecodingOptions): Result<any> {
  return match([options.typeCastingStrategy, type.literalValue, value])
    .with([P._, P._, P.when((value) => value === type.literalValue)], ([_opts, literal, _value]) => success(literal))
    .with(['tryCasting', null, 'null'], ([_opts, literal, _value]) => success(literal))
    .otherwise((_) => error(`Expected the literal ${type.literalValue}`, value))
  /*
    const castedValue = decodeInternal(union({ n: number(), b: boolean(), s: string() }), value, opts)
    if (castedValue.success) {
      if (t.value === castedValue.value) {
        return success(t.value)
      }
    }
  */
}

/**
 * Tries to decode a value as a memeber of an enum: the decoding is successfull if the value is one of the variants of
 * the enum.
 */
function decodeEnum(type: EnumType<any>, value: unknown): Result<any> {
  return type.variants.includes(value)
    ? success(value)
    : error(`Expected an enum (${type.variants.map((v: any) => `"${v}"`).join(' | ')})`, value)
}

/**
 * Tries to decode an optional value: if it gets an `undefined` it succeeds, otherwise it tries to decode `value` as a
 * value of the wrapped type.
 */
function decodeOptional(type: OptionalType<any>, value: unknown, options: DecodingOptions): Result<any> {
  return match(value)
    .with(undefined, (_) => success(undefined))
    .with(null, (_) => success(undefined))
    .with(P._, (value) => unsafeDecode(type.wrappedType, value, options))
    .otherwise((_) => error('Expected optional value', value))
}

/**
 * Tries to decode a nullable value: if it gets a `null` it succeeds, otherwise it tries to decode `value` as a value
 * of the wrapped type.
 */
function decodeNullable<T extends Type>(
  type: NullableType<T>,
  value: unknown,
  options: DecodingOptions,
): Result<T | null> {
  return match([options.typeCastingStrategy, value])
    .with([P._, null], (_) => success(null))
    .with(['tryCasting', undefined], (_) => success(null))
    .with([P._, P._], ([_, value]) => unsafeDecode(type.wrappedType, value, options) as Result<T | null>)
    .otherwise((_) => error('Expected nullable value', value))
}

/**
 * Tries to decode a reference value by decoding `value` as a value of the wrapped type.
 */
function decodeReference(type: ReferenceType<any>, value: unknown, options: DecodingOptions): Result<any> {
  return unsafeDecode(type.wrappedType, value, options)
}

/**
 * Tries to decode an array by decoding each of its values as a value of the wrapped type.
 */
function decodeArray(type: ArrayType<any, any>, value: unknown, options: DecodingOptions): Result<any> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.array(P._)], ([_, array]) => decodeArrayValues(type, array, options))
    .with(['tryCasting', P.instanceOf(Object)], ([_, object]) => decodeObjectAsArray(type, object, options))
    .otherwise((_) => error('Expected array', value))
}

/**
 * Decodes the values of an array returning an array of decoded values if successful.
 */
function decodeArrayValues(type: ArrayType<any, any>, array: unknown[], options: DecodingOptions): Result<any> {
  const decodingErrors = []
  const decodedValues = []

  for (const value of array) {
    const result = unsafeDecode(type.wrappedType, value, options)
    if (result.success) {
      decodedValues.push(result.value)
    } else {
      // const enrichedResult = enrichErrors(result, [i]) TODO: what does this do?
      decodingErrors.push(...result.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return errors.length === 0 ? success(decodedValues) : errors(decodingErrors)
}

/**
 * Tries to decode an object as an array.
 */
function decodeObjectAsArray(type: ArrayType<any, any>, object: Object, options: DecodingOptions): Result<any> {
  return concat2(objectToArray(object), (object) => decodeArrayValues(type, Object.values(object), options))
}

/**
 * @param object an object to check for array-castability
 * @returns the values of the object sorted by their key, if the given object is castable as an array: that is, if all
 *          its keys are consecutive numbers from `0` up to a given `n`
 */
function objectToArray(object: Object): Result<any[]> {
  const keys = keysAsConsecutiveNumbers(object)
  return keys === undefined
    ? error('Expected array like object', object)
    : success(keys.map((i) => object[i as keyof object]))
}

/**
 * @param object the object whose keys will be converted to an array of sorted numbers
 * @returns an array of sorted numbers if all the keys of `object` are numbers (starting from 0) and consecutive, that
 *          is, the object is in the form `{0: "a", 1: "b", 2: "c", ...}`
 */
function keysAsConsecutiveNumbers(object: Object): number[] | undefined {
  const keys = Object.keys(object).map(Number).sort()
  const startsAtZero = keys.at(0) === 0
  return startsAtZero && allConsecutive(keys) ? keys : undefined
}

/**
 * @param numbers a _non empty_ array of numbers
 * @returns `true` if all numbers in the array are consecutive in ascending order, that is the array is in the form
 *          `[n, n+1, n+2, ...]`
 */
function allConsecutive(numbers: number[]): boolean {
  const [previousNumber, ...rest] = numbers
  for (const number of rest) {
    const isConsecutive = previousNumber + 1 === number
    if (!isConsecutive) {
      return false
    }
  }
  return true
}

/**
 * Tries to decode a value belonging to a union as described by `type`.
 */
function decodeUnion(type: UnionType<any>, value: unknown, options: DecodingOptions): Result<any> {
  return options.unionDecodingStrategy === 'untaggedUnions'
    ? decodeUntaggedUnion(type, value, options)
    : decodeTaggedUnion(type, value, options)
}

function decodeUntaggedUnion(type: UnionType<any>, value: unknown, options: DecodingOptions): Result<any> {
  const decodingErrors: Error[] = []
  for (const [variantName, variantType] of Object.entries(type.variants)) {
    const result = unsafeDecode(variantType as Type, value, options)
    if (result.success) {
      return result
    } else {
      decodingErrors.push(...result.errors.map((error) => ({ ...error, unionElement: variantName })))
    }
  }
  return errors(decodingErrors)
}

function decodeTaggedUnion(type: UnionType<any>, value: unknown, options: DecodingOptions): Result<any> {
  const entries = Object.entries(type.variants)
  if (typeof value === 'object' && value) {
    const objectKey = singleKeyFromObject(value)
    if (objectKey !== undefined && containsKey(entries, objectKey)) {
      return unsafeDecode(type.variants[objectKey], (value as Record<string, any>)[objectKey], options)
    }
  }
  return error(`Expect exactly one of this property ${entries.map((v) => `'${v[0]}'`).join(', ')}`, value)
}

/**
 * @param object the object from which to extract a single key
 * @returns the key of the object if it has exactly one key; otherwise, it returns `undefined`
 */
function singleKeyFromObject(object: object): string | undefined {
  const keys = Object.keys(object)
  return keys.length === 1 ? keys[0] : undefined
}

function decodeObject(type: ObjectType<any, any>, value: unknown, options: DecodingOptions): Result<any> {
  return concat2(castToObject(value), (object) => decodeObjectProperties(type, object, options))
}

function castToObject(value: unknown): Result<Record<string, unknown>> {
  return typeof value === 'object' ? success(value as Record<string, unknown>) : error('Expected an object', value)
}

function decodeObjectProperties(
  type: ObjectType<any, any>,
  object: Record<string, unknown>,
  options: DecodingOptions,
): Result<any> {
  const decodingErrors: Error[] = []
  const decodedObject: { [key: string]: unknown } = {} // strict ? {} : { ...value }
  for (const [fieldName, fieldType] of Object.entries(type.types)) {
    const result = unsafeDecode(fieldType as Type, object[fieldName], options)
    // const enrichedResult = enrichErrors(result, [key]) TODO: what does this do?
    if (result.success && result !== undefined) {
      decodedObject[fieldName] = result.value
    } else if (!result.success) {
      decodingErrors.push(...result.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        return errors(decodingErrors)
      }
    }
  }
  return errors.length > 0 ? errors(decodingErrors) : success(decodedObject)
}

/* TODO: Add custom type back
  else if (t.kind === 'custom') {
    const preDecoded = decodeAndValidate(t.encodedType, value, opts)
    if (!preDecoded.success) {
      return preDecoded
    }
    const result = t.decode(preDecoded.value, t.opts, opts)
    if (!result.success) {
      return result
    }
    return result
  }
  assertNever(t)
}
*/
