import { types, result, validator } from './index'
import { containsKey } from './utils'
import { match, Pattern as P } from 'ts-pattern'

/**
 * The options that can be used when decoding a type.
 */
export type DecodingOptions = {
  typeCastingStrategy: 'tryCasting' | 'expectExactTypes'
  errorReportingStrategy: 'allErrors' | 'stopAtFirstError'
  unionDecodingStrategy: 'taggedUnions' | 'untaggedUnions'
}

/**
 * The default recommended options to be used in the decoding process.
 */
export const defaultOptions: DecodingOptions = {
  typeCastingStrategy: 'expectExactTypes',
  errorReportingStrategy: 'stopAtFirstError',
  unionDecodingStrategy: 'untaggedUnions',
}

/**
 * TODO: add doc
 * @param type
 * @param value
 * @param decodingOptions
 * @param validationOptions
 * @returns
 */
export function decode<T extends types.Type>(
  type: T,
  value: unknown,
  decodingOptions?: Partial<DecodingOptions>,
  validationOptions?: Partial<validator.ValidationOptions>,
): result.Result<types.Infer<T>> {
  const actualDecodingOptions = { ...defaultOptions, ...decodingOptions }
  // TODO: if we ever rework the current Error interface (maybe we should and factor out the short circuiting logic in
  // a generic error like other languages like Scala/Haskell/Elm/Gleam/Rust) this should be rewritten as a series
  // of `.then().then()`
  const decodingResult = unsafeDecode(type, value, actualDecodingOptions) as result.Result<types.Infer<T>>
  if (decodingResult.success) {
    const validationResult = validator.validate(type, decodingResult.value, validationOptions)
    if (validationResult.success) {
      return decodingResult
    } else {
      return result.enrichErrors({ success: false, errors: validationResult.errors } as result.Result<types.Infer<T>>)
    }
  } else {
    return result.enrichErrors(decodingResult)
  }
}

function unsafeDecode(type: types.Type, value: unknown, options: DecodingOptions): result.Result<unknown> {
  return match(types.concretise(type))
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
    .with({ kind: 'custom' }, (type) => type.decode(value, options, type.options))
    .exhaustive()
}

/**
 * Tries to decode a boolean value.
 */
function decodeBoolean(value: unknown, options: DecodingOptions): result.Result<boolean> {
  return match([options.typeCastingStrategy, value])
    .with([P._, true], () => result.success(true))
    .with([P._, false], () => result.success(false))
    .with(['tryCasting', 'true'], () => result.success(true))
    .with(['tryCasting', 'false'], () => result.success(false))
    .with(['tryCasting', P.number], ([_, n]) => result.success(n !== 0))
    .otherwise((_) => result.error('Expected a boolean', value))
}

/**
 * Tries to decode a number value.
 */
function decodeNumber(value: unknown, options: DecodingOptions): result.Result<number> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.number], ([_, n]) => result.success(n))
    .with(['tryCasting', P.string], ([_, s]) => numberFromString(s))
    .otherwise((_) => result.error('Expected a number', value))
}

function numberFromString(string: string): result.Result<number> {
  return match(Number(string))
    .with(NaN, (_) => result.error('Expected a number', string))
    .with(P.number, (n) => result.success(n))
    .exhaustive()
}

/**
 * Tries to decode a string value.
 */
function decodeString(value: unknown, options: DecodingOptions): result.Result<string> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.string], ([_, s]) => result.success(s))
    .with(['tryCasting', P.number], ([_, n]) => result.success(n.toString()))
    .with(['tryCasting', P.boolean], ([_, b]) => result.success(b.toString()))
    .otherwise((_) => result.error('Expected a string', value))
}

/**
 * Tries to decode a literal value.
 */
function decodeLiteral(type: types.LiteralType<any>, value: unknown, options: DecodingOptions): result.Result<any> {
  return match([options.typeCastingStrategy, type.literalValue, value])
    .with([P._, P._, P.when((value) => value === type.literalValue)], ([_opts, literal, _value]) =>
      result.success(literal),
    )
    .with(['tryCasting', null, 'null'], ([_opts, literal, _value]) => result.success(literal))
    .otherwise((_) => result.error(`Expected the literal ${type.literalValue}`, value))
  /*
    const castedValue = decodeInternal(union({ n: number(), b: boolean(), s: string() }), value, opts)
    if (castedValue.success) {
      if (t.value === castedValue.value) {
        return result.success(t.value)
      }
    }
  */
}

/**
 * Tries to decode a value as a memeber of an enum: the decoding is successfull if the value is one of the variants of
 * the enum.
 */
function decodeEnum(type: types.EnumType<any>, value: unknown): result.Result<any> {
  return type.variants.includes(value)
    ? result.success(value)
    : result.error(`Expected an enum (${type.variants.map((v: any) => `"${v}"`).join(' | ')})`, value)
}

/**
 * Tries to decode an optional value: if it gets an `undefined` it succeeds, otherwise it tries to decode `value` as a
 * value of the wrapped type.
 */
function decodeOptional(type: types.OptionalType<any>, value: unknown, options: DecodingOptions): result.Result<any> {
  return match(value)
    .with(undefined, (_) => result.success(undefined))
    .with(null, (_) => result.success(undefined))
    .with(P._, (value) => unsafeDecode(type.wrappedType, value, options))
    .otherwise((_) => result.error('Expected optional value', value))
}

/**
 * Tries to decode a nullable value: if it gets a `null` it succeeds, otherwise it tries to decode `value` as a value
 * of the wrapped type.
 */
function decodeNullable<T extends types.Type>(
  type: types.NullableType<T>,
  value: unknown,
  options: DecodingOptions,
): result.Result<T | null> {
  return match([options.typeCastingStrategy, value])
    .with([P._, null], (_) => result.success(null))
    .with(['tryCasting', undefined], (_) => result.success(null))
    .with([P._, P._], ([_, value]) => unsafeDecode(type.wrappedType, value, options) as result.Result<T | null>)
    .otherwise((_) => result.error('Expected nullable value', value))
}

/**
 * Tries to decode a reference value by decoding `value` as a value of the wrapped type.
 */
function decodeReference(type: types.ReferenceType<any>, value: unknown, options: DecodingOptions): result.Result<any> {
  return unsafeDecode(type.wrappedType, value, options)
}

/**
 * Tries to decode an array by decoding each of its values as a value of the wrapped type.
 */
function decodeArray(type: types.ArrayType<any, any>, value: unknown, options: DecodingOptions): result.Result<any> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.array(P._)], ([_, array]) => decodeArrayValues(type, array, options))
    .with(['tryCasting', P.instanceOf(Object)], ([_, object]) => decodeObjectAsArray(type, object, options))
    .otherwise((_) => result.error('Expected array', value))
}

/**
 * Decodes the values of an array returning an array of decoded values if successful.
 */
function decodeArrayValues(
  type: types.ArrayType<any, any>,
  array: unknown[],
  options: DecodingOptions,
): result.Result<any> {
  const decodingErrors: result.Error[] = []
  const decodedValues = []

  for (const value of array) {
    const res = unsafeDecode(type.wrappedType, value, options)
    if (res.success) {
      decodedValues.push(res.value)
    } else {
      // const enrichedResult = result.enrichErrors(result, [i]) TODO: what does this do?
      decodingErrors.push(...res.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return decodingErrors.length === 0 ? result.success(decodedValues) : result.errors(decodingErrors)
}

/**
 * Tries to decode an object as an array.
 */
function decodeObjectAsArray(
  type: types.ArrayType<any, any>,
  object: Object,
  options: DecodingOptions,
): result.Result<any> {
  return result.concat2(objectToArray(object), (object) => decodeArrayValues(type, Object.values(object), options))
}

/**
 * @param object an object to check for array-castability
 * @returns the values of the object sorted by their key, if the given object is castable as an array: that is, if all
 *          its keys are consecutive numbers from `0` up to a given `n`
 */
function objectToArray(object: Object): result.Result<any[]> {
  const keys = keysAsConsecutiveNumbers(object)
  return keys === undefined
    ? result.error('Expected array like object', object)
    : result.success(keys.map((i) => object[i as keyof object]))
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
function decodeUnion(type: types.UnionType<any>, value: unknown, options: DecodingOptions): result.Result<any> {
  return options.unionDecodingStrategy === 'untaggedUnions'
    ? decodeUntaggedUnion(type, value, options)
    : decodeTaggedUnion(type, value, options)
}

function decodeUntaggedUnion(type: types.UnionType<any>, value: unknown, options: DecodingOptions): result.Result<any> {
  const decodingErrors: result.Error[] = []
  for (const [variantName, variantType] of Object.entries(type.variants)) {
    const decodingResult = unsafeDecode(variantType as types.Type, value, options)
    if (decodingResult.success) {
      return decodingResult
    } else {
      decodingErrors.push(...decodingResult.errors.map((e) => ({ ...e, unionElement: variantName })))
    }
  }
  return result.errors(decodingErrors)
}

function decodeTaggedUnion(type: types.UnionType<any>, value: unknown, options: DecodingOptions): result.Result<any> {
  const entries = Object.entries(type.variants)
  if (typeof value === 'object' && value) {
    const objectKey = singleKeyFromObject(value)
    if (objectKey !== undefined && containsKey(entries, objectKey)) {
      return unsafeDecode(type.variants[objectKey], (value as Record<string, any>)[objectKey], options)
    }
  }
  return result.error(`Expect exactly one of this property ${entries.map((v) => `'${v[0]}'`).join(', ')}`, value)
}

/**
 * @param object the object from which to extract a single key
 * @returns the key of the object if it has exactly one key; otherwise, it returns `undefined`
 */
function singleKeyFromObject(object: object): string | undefined {
  const keys = Object.keys(object)
  return keys.length === 1 ? keys[0] : undefined
}

function decodeObject(type: types.ObjectType<any, any>, value: unknown, options: DecodingOptions): result.Result<any> {
  return result.concat2(castToObject(value), (object) => decodeObjectProperties(type, object, options))
}

function castToObject(value: unknown): result.Result<Record<string, unknown>> {
  return typeof value === 'object'
    ? result.success(value as Record<string, unknown>)
    : result.error('Expected an object', value)
}

function decodeObjectProperties(
  type: types.ObjectType<any, any>,
  object: Record<string, unknown>,
  options: DecodingOptions,
): result.Result<any> {
  const decodingErrors: result.Error[] = []
  const decodedObject: { [key: string]: unknown } = {} // strict ? {} : { ...value }
  for (const [fieldName, fieldType] of Object.entries(type.types)) {
    const decodingResult = unsafeDecode(fieldType as types.Type, object[fieldName], options)
    // const enrichedResult = result.enrichErrors(result, [key]) TODO: what does this do?
    if (decodingResult.success && decodingResult !== undefined) {
      decodedObject[fieldName] = decodingResult.value
    } else if (!decodingResult.success) {
      decodingErrors.push(...decodingResult.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        return result.errors(decodingErrors)
      }
    }
  }
  return decodingErrors.length > 0 ? result.errors(decodingErrors) : result.success(decodedObject)
}
