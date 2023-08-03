import { types, decoder, result, validator, path } from './index'
import { match, Pattern as P } from 'ts-pattern'

/**
 * The options that can be used when decoding a type.
 */
export type Options = {
  typeCastingStrategy: 'tryCasting' | 'expectExactTypes'
  errorReportingStrategy: 'allErrors' | 'stopAtFirstError'
  unionDecodingStrategy: 'taggedUnions' | 'untaggedUnions'
}

/**
 * The default recommended options to be used in the decoding process.
 */
export const defaultOptions: Options = {
  typeCastingStrategy: 'expectExactTypes',
  errorReportingStrategy: 'stopAtFirstError',
  unionDecodingStrategy: 'untaggedUnions',
}

/**
 * The result of the process of decoding: it can either hold a value or an array of decoding errors.
 */
export type Result<A> = result.Result<A, decoder.Error[]>

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
  decodingOptions?: Partial<Options>,
  validationOptions?: Partial<validator.Options>,
): result.Result<types.Infer<T>, validator.Error[] | decoder.Error[]> {
  return decodeWithoutValidation(type, value, decodingOptions)
    .mapError((errors) => errors as validator.Error[] | decoder.Error[])
    .then((decodedValue) => {
      return validator.validate<T>(type, decodedValue, validationOptions).replace(decodedValue)
    })
}

/**
 * TODO: add doc and make sure that it makes clear that this should be used for custom decoders only
 * @param type
 * @param value
 * @param decodingOptions
 * @returns
 */
export function decodeWithoutValidation<T extends types.Type>(
  type: T,
  value: unknown,
  decodingOptions?: Partial<Options>,
): decoder.Result<types.Infer<T>> {
  const actualOptions = { ...defaultOptions, ...decodingOptions }
  return unsafeDecode(type, value, actualOptions) as decoder.Result<types.Infer<T>>
}

/**
 * TODO: add doc
 */
export type Error = {
  expected: string
  got: unknown
  path: path.Path
}

/**
 * Utility function to add a new expected type to the `expected` field of a `decoder.Error`.
 */
function addExpected(otherExpected: string): (error: decoder.Error) => decoder.Error {
  return (error: decoder.Error) => ({
    ...error,
    expected: `${error.expected} or ${otherExpected}`,
  })
}

/**
 * Utility function to prepend a prefix to the path of a `decoder.Error`.
 */
function prependFieldToPath(fieldName: string): (error: decoder.Error) => decoder.Error {
  return (error: decoder.Error) => ({ ...error, path: error.path.prependField(fieldName) })
}

/**
 * Utility function to prepend an index to the path of a `decoder.Error`.
 */
function prependIndexToPath(index: number): (error: decoder.Error) => decoder.Error {
  return (error: decoder.Error) => ({ ...error, path: error.path.prependIndex(index) })
}

/**
 * Utility function to prepend a variant to the path of a `decoder.Error`.
 */
function prependVariantToPath(variantName: string): (error: decoder.Error) => decoder.Error {
  return (error: decoder.Error) => ({ ...error, path: error.path.prependVariant(variantName) })
}

/**
 * @param value the value the decoding result will return
 * @returns a `decoder.Result` that succeeds with the given value
 */
export const succeed = <A>(value: A): decoder.Result<A> => result.ok(value)

/**
 * @param errors the errors that made the decoding process fail
 * @returns a `decoder.Result` that fails with the given array of errors
 */
export const failWithErrors = <A>(errors: decoder.Error[]): decoder.Result<A> => result.fail(errors)

/**
 * @param expected the expected value
 * @param got the actual value that couldn't be decoded
 * @returns a `decoder.Result` that fails with a single error with an empty path and the provided
 *          `expected` and `got` values
 */
export const fail = <A>(expected: string, got: unknown): decoder.Result<A> =>
  decoder.failWithErrors([{ expected, got, path: path.empty() }])

function unsafeDecode(type: types.Type, value: unknown, options: Options): decoder.Result<unknown> {
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
function decodeBoolean(value: unknown, options: Options): decoder.Result<boolean> {
  return match([options.typeCastingStrategy, value])
    .with([P._, true], () => decoder.succeed(true))
    .with([P._, false], () => decoder.succeed(false))
    .with(['tryCasting', 'true'], () => decoder.succeed(true))
    .with(['tryCasting', 'false'], () => decoder.succeed(false))
    .with(['tryCasting', P.number], ([_, n]) => decoder.succeed(n !== 0))
    .otherwise((_) => decoder.fail('boolean', value))
}

/**
 * Tries to decode a number value.
 */
function decodeNumber(value: unknown, options: Options): decoder.Result<number> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.number], ([_, n]) => decoder.succeed(n))
    .with(['tryCasting', P.string], ([_, s]) => numberFromString(s))
    .otherwise((_) => decoder.fail('number', value))
}

function numberFromString(string: string): decoder.Result<number> {
  return match(Number(string))
    .with(NaN, (_) => fail<number>('number', string))
    .with(P.number, (n) => decoder.succeed(n))
    .exhaustive()
}

/**
 * Tries to decode a string value.
 */
function decodeString(value: unknown, options: Options): decoder.Result<string> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.string], ([_, s]) => decoder.succeed(s))
    .with(['tryCasting', P.number], ([_, n]) => decoder.succeed(n.toString()))
    .with(['tryCasting', P.boolean], ([_, b]) => decoder.succeed(b.toString()))
    .otherwise((_) => decoder.fail('string', value))
}

/**
 * Tries to decode a literal value.
 */
function decodeLiteral(type: types.LiteralType<any>, value: unknown, options: Options): decoder.Result<any> {
  return match([options.typeCastingStrategy, type.literalValue, value])
    .with([P._, P._, P.when((value) => value === type.literalValue)], ([_options, literal, _value]) =>
      decoder.succeed(literal),
    )
    .with(['tryCasting', null, 'null'], ([_options, literal, _value]) => decoder.succeed(literal))
    .otherwise((_) => decoder.fail(`literal (${type.literalValue})`, value))
  /*
    const castedValue = decodeInternal(union({ n: number(), b: boolean(), s: string() }), value, opts)
    if (castedValue.success) {
      if (t.value === castedValue.value) {
        return ok(t.value)
      }
    }
  */
}

/**
 * Tries to decode a value as a memeber of an enum: the decoding is successfull if the value is one of the variants of
 * the enum.
 */
function decodeEnum(type: types.EnumType<any>, value: unknown): decoder.Result<any> {
  return type.variants.includes(value)
    ? decoder.succeed(value)
    : decoder.fail(`enum (${type.variants.map((v: any) => `"${v}"`).join(' | ')})`, value)
}

/**
 * Tries to decode an optional value: if it gets an `undefined` it succeeds, otherwise it tries to decode `value` as a
 * value of the wrapped type.
 */
function decodeOptional(type: types.OptionalType<any>, value: unknown, options: Options): decoder.Result<any> {
  return match(value)
    .with(undefined, (_) => decoder.succeed(undefined))
    .with(null, (_) => decoder.succeed(undefined))
    .with(P._, (value) =>
      unsafeDecode(type.wrappedType, value, options).mapError((errors) => errors.map(addExpected('undefined'))),
    )
    .exhaustive()
}

/**
 * Tries to decode a nullable value: if it gets a `null` it succeeds, otherwise it tries to decode `value` as a value
 * of the wrapped type.
 */
function decodeNullable<T extends types.Type>(
  type: types.NullableType<T>,
  value: unknown,
  options: Options,
): decoder.Result<T | null> {
  return match([options.typeCastingStrategy, value])
    .with([P._, null], (_) => decoder.succeed(null))
    .with(['tryCasting', undefined], (_) => decoder.succeed(null))
    .with(
      [P._, P._],
      ([_, value]) =>
        unsafeDecode(type.wrappedType, value, options).mapError((errors) =>
          errors.map(addExpected('null')),
        ) as decoder.Result<T | null>,
    )
    .exhaustive()
}

/**
 * Tries to decode a reference value by decoding `value` as a value of the wrapped type.
 */
function decodeReference(type: types.ReferenceType<any>, value: unknown, options: Options): decoder.Result<any> {
  return unsafeDecode(type.wrappedType, value, options)
}

/**
 * Tries to decode an array by decoding each of its values as a value of the wrapped type.
 */
function decodeArray(type: types.ArrayType<any, any>, value: unknown, options: Options): decoder.Result<any> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.array(P._)], ([_, array]) => decodeArrayValues(type, array, options))
    .with(['tryCasting', P.instanceOf(Object)], ([_, object]) => decodeObjectAsArray(type, object, options))
    .otherwise((_) => decoder.fail('array', value))
}

/**
 * Decodes the values of an array returning an array of decoded values if successful.
 */
function decodeArrayValues(type: types.ArrayType<any, any>, array: unknown[], options: Options): decoder.Result<any> {
  const decodingErrors: decoder.Error[] = []
  const decodedValues: unknown[] = []
  for (let i = 0; i < array.length; i++) {
    const value = array[i]
    const decodedItem = unsafeDecode(type.wrappedType, value, options)
    if (decodedItem.isOk) {
      decodedValues.push(decodedItem.value)
    } else {
      decodingErrors.push(...decodedItem.error.map(prependIndexToPath(i)))
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return decodingErrors.length > 0 ? decoder.failWithErrors(decodingErrors) : decoder.succeed(decodedValues)
}

/**
 * Tries to decode an object as an array.
 */
function decodeObjectAsArray(type: types.ArrayType<any, any>, object: Object, options: Options): decoder.Result<any> {
  return objectToArray(object).then((object) => decodeArrayValues(type, Object.values(object), options))
}

/**
 * @param object an object to check for array-castability
 * @returns the values of the object sorted by their key, if the given object is castable as an array: that is, if all
 *          its keys are consecutive numbers from `0` up to a given `n`
 */
function objectToArray(object: Object): decoder.Result<any[]> {
  const keys = keysAsConsecutiveNumbers(object)
  return keys === undefined
    ? decoder.fail('array', object)
    : decoder.succeed(keys.map((i) => object[i as keyof object]))
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
function decodeUnion(type: types.UnionType<any>, value: unknown, options: Options): decoder.Result<any> {
  return options.unionDecodingStrategy === 'untaggedUnions'
    ? decodeUntaggedUnion(type, value, options)
    : decodeTaggedUnion(type, value, options)
}

function decodeUntaggedUnion(type: types.UnionType<any>, value: unknown, options: Options): decoder.Result<any> {
  const decodingErrors: decoder.Error[] = []
  for (const [variantName, variantType] of Object.entries(type.variants)) {
    const decodedVariant = unsafeDecode(variantType as types.Type, value, options)
    if (decodedVariant.isOk) {
      return decoder.succeed(decodedVariant.value)
    } else {
      decodingErrors.push(...decodedVariant.error.map(prependVariantToPath(variantName)))
    }
  }
  return decoder.failWithErrors(decodingErrors)
}

function decodeTaggedUnion(type: types.UnionType<any>, value: unknown, options: Options): decoder.Result<any> {
  if (typeof value === 'object' && value) {
    const object = value as Record<string, any>
    const variantName = singleKeyFromObject(object)
    if (variantName !== undefined && Object.keys(type.variants).includes(variantName)) {
      const decodingResult = unsafeDecode(type.variants[variantName], object[variantName], options)
      return decodingResult.mapError((errors) => errors.map(prependVariantToPath(variantName)))
    }
  }
  const prettyVariants = Object.keys(type.variants).join(', ')
  return decoder.fail(`union (${prettyVariants})`, value)
}

/**
 * @param object the object from which to extract a single key
 * @returns the key of the object if it has exactly one key; otherwise, it returns `undefined`
 */
function singleKeyFromObject(object: object): string | undefined {
  const keys = Object.keys(object)
  return keys.length === 1 ? keys[0] : undefined
}

function decodeObject(type: types.ObjectType<any, any>, value: unknown, options: Options): decoder.Result<any> {
  return castToObject(value).then((object) => decodeObjectProperties(type, object, options))
}

function castToObject(value: unknown): decoder.Result<Record<string, unknown>> {
  return typeof value === 'object' ? decoder.succeed(value as Record<string, unknown>) : decoder.fail('object', value)
}

function decodeObjectProperties(
  type: types.ObjectType<any, any>,
  object: Record<string, unknown>,
  options: Options,
): decoder.Result<any> {
  const decodingErrors: decoder.Error[] = []
  const decodedObject: { [key: string]: unknown } = {} // strict ? {} : { ...value }
  for (const [fieldName, fieldType] of Object.entries(type.types)) {
    const decodedField = unsafeDecode(fieldType as types.Type, object[fieldName], options)
    if (decodedField.isOk) {
      if (decodedField.value !== undefined) {
        decodedObject[fieldName] = decodedField.value
      }
    } else {
      decodingErrors.push(...decodedField.error.map(prependFieldToPath(fieldName)))
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return decodingErrors.length > 0 ? decoder.failWithErrors(decodingErrors) : decoder.succeed(decodedObject)
}

// TODO rimuovere union
