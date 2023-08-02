import { types, result, validator } from './index'
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
export type Result<A> = result.Result<A, Error[]>

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
): result.Result<types.Infer<T>, validator.Error[] | Error[]> {
  const actualOptions = { ...defaultOptions, ...decodingOptions }
  type R = result.Result<types.Infer<T>, validator.Error[] | Error[]>
  const decodingResult = unsafeDecode(type, value, actualOptions) as R
  return decodingResult.then((decodedValue) =>
    validator.validate<T>(type, decodedValue, validationOptions).replace(decodedValue),
  )

  /*
  // TODO: if we ever rework the current Error interface (maybe we should and factor out the short circuiting logic in
  // a generic error like other languages like Scala/Haskell/Elm/Gleam/Rust) this should be rewritten as a series
  // of `.then().then()`
  const decodingResult = unsafeDecode(type, value, actualOptions) as result.Result<types.Infer<T>>
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
  */
}

/**
 * TODO: add doc
 */
export type Error = {
  expected: string
  got: unknown
  path: string[]
}

/**
 * Utility function to add a new expected type to the `expected` field of a `decoder.Error`.
 */
function addExpected(otherExpected: string): (error: Error) => Error {
  return (error: Error) => ({
    ...error,
    expected: `${error.expected} or ${otherExpected}`,
  })
}

/**
 * Utility function to prepend a prefix to the path of a `decoder.Error`.
 */
function prependToPath(prefix: string): (error: Error) => Error {
  // ⚠️ Possible pain point: error is mutated in place so if an error is shared and multiple pieces
  // update it, it may lead to wrong error messages.
  return (error: Error) => {
    error.path.unshift(prefix)
    return error
  }
}

/**
 * @param value the value the decoding result will return
 * @returns a `decoder.Result` that succeeds with the given value
 */
export const succeed = <A>(value: A): Result<A> => result.ok(value)

/**
 * @param errors the errors that made the decoding process fail
 * @returns a `decoder.Result` that fails with the given array of errors
 */
export const fail = <A>(errors: Error[]): Result<A> => result.fail(errors)

/**
 * @param expected the expected value
 * @param got the actual value that couldn't be decoded
 * @returns a `decoder.Result` that fails with a single error with an empty path and the provided
 *          `expected` and `got` values
 */
export const baseFail = <A>(expected: string, got: unknown): Result<A> => fail([{ expected, got, path: [] }])

function unsafeDecode(type: types.Type, value: unknown, options: Options): Result<unknown> {
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
function decodeBoolean(value: unknown, options: Options): Result<boolean> {
  return match([options.typeCastingStrategy, value])
    .with([P._, true], () => succeed(true))
    .with([P._, false], () => succeed(false))
    .with(['tryCasting', 'true'], () => succeed(true))
    .with(['tryCasting', 'false'], () => succeed(false))
    .with(['tryCasting', P.number], ([_, n]) => succeed(n !== 0))
    .otherwise((_) => baseFail('boolean', value))
}

/**
 * Tries to decode a number value.
 */
function decodeNumber(value: unknown, options: Options): Result<number> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.number], ([_, n]) => succeed(n))
    .with(['tryCasting', P.string], ([_, s]) => numberFromString(s))
    .otherwise((_) => baseFail('number', value))
}

function numberFromString(string: string): Result<number> {
  return match(Number(string))
    .with(NaN, (_) => baseFail<number>('number', string))
    .with(P.number, (n) => succeed(n))
    .exhaustive()
}

/**
 * Tries to decode a string value.
 */
function decodeString(value: unknown, options: Options): Result<string> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.string], ([_, s]) => succeed(s))
    .with(['tryCasting', P.number], ([_, n]) => succeed(n.toString()))
    .with(['tryCasting', P.boolean], ([_, b]) => succeed(b.toString()))
    .otherwise((_) => baseFail('string', value))
}

/**
 * Tries to decode a literal value.
 */
function decodeLiteral(type: types.LiteralType<any>, value: unknown, options: Options): Result<any> {
  return match([options.typeCastingStrategy, type.literalValue, value])
    .with([P._, P._, P.when((value) => value === type.literalValue)], ([_opts, literal, _value]) => succeed(literal))
    .with(['tryCasting', null, 'null'], ([_opts, literal, _value]) => succeed(literal))
    .otherwise((_) => baseFail(`literal (${type.literalValue})`, value))
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
function decodeEnum(type: types.EnumType<any>, value: unknown): Result<any> {
  return type.variants.includes(value)
    ? succeed(value)
    : baseFail(`enum (${type.variants.map((v: any) => `"${v}"`).join(' | ')})`, value)
}

/**
 * Tries to decode an optional value: if it gets an `undefined` it succeeds, otherwise it tries to decode `value` as a
 * value of the wrapped type.
 */
function decodeOptional(type: types.OptionalType<any>, value: unknown, options: Options): Result<any> {
  return match(value)
    .with(undefined, (_) => succeed(undefined))
    .with(null, (_) => succeed(undefined))
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
): Result<T | null> {
  return match([options.typeCastingStrategy, value])
    .with([P._, null], (_) => succeed(null))
    .with(['tryCasting', undefined], (_) => succeed(null))
    .with(
      [P._, P._],
      ([_, value]) =>
        unsafeDecode(type.wrappedType, value, options).mapError((errors) =>
          errors.map(addExpected('null')),
        ) as Result<T | null>,
    )
    .exhaustive()
}

/**
 * Tries to decode a reference value by decoding `value` as a value of the wrapped type.
 */
function decodeReference(type: types.ReferenceType<any>, value: unknown, options: Options): Result<any> {
  return unsafeDecode(type.wrappedType, value, options)
}

/**
 * Tries to decode an array by decoding each of its values as a value of the wrapped type.
 */
function decodeArray(type: types.ArrayType<any, any>, value: unknown, options: Options): Result<any> {
  return match([options.typeCastingStrategy, value])
    .with([P._, P.array(P._)], ([_, array]) => decodeArrayValues(type, array, options))
    .with(['tryCasting', P.instanceOf(Object)], ([_, object]) => decodeObjectAsArray(type, object, options))
    .otherwise((_) => baseFail('array', value))
}

/**
 * Decodes the values of an array returning an array of decoded values if successful.
 */
function decodeArrayValues(type: types.ArrayType<any, any>, array: unknown[], options: Options): Result<any> {
  const decodingErrors: Error[] = []
  const decodedValues: unknown[] = []

  let encounteredError = false
  for (let i = 0; i < array.length; i++) {
    const value = array[i]
    unsafeDecode(type.wrappedType, value, options).match(
      (decodedValue) => {
        decodedValues.push(decodedValue)
      },
      (errors) => {
        encounteredError = true
        decodingErrors.push(...errors.map(prependToPath(`[${i}]`)))
      },
    )
    if (options.errorReportingStrategy === 'stopAtFirstError' && encounteredError) {
      break
    }
  }
  return encounteredError ? succeed(decodedValues) : fail(decodingErrors)
}

/**
 * Tries to decode an object as an array.
 */
function decodeObjectAsArray(type: types.ArrayType<any, any>, object: Object, options: Options): Result<any> {
  return objectToArray(object).then((object) => decodeArrayValues(type, Object.values(object), options))
}

/**
 * @param object an object to check for array-castability
 * @returns the values of the object sorted by their key, if the given object is castable as an array: that is, if all
 *          its keys are consecutive numbers from `0` up to a given `n`
 */
function objectToArray(object: Object): Result<any[]> {
  const keys = keysAsConsecutiveNumbers(object)
  return keys === undefined ? baseFail('array', object) : succeed(keys.map((i) => object[i as keyof object]))
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
function decodeUnion(type: types.UnionType<any>, value: unknown, options: Options): Result<any> {
  return options.unionDecodingStrategy === 'untaggedUnions'
    ? decodeUntaggedUnion(type, value, options)
    : decodeTaggedUnion(type, value, options)
}

function decodeUntaggedUnion(type: types.UnionType<any>, value: unknown, options: Options): Result<any> {
  const decodingErrors: Error[] = []
  let decodedValue = undefined
  let hasDecoded = false
  let encounteredError = false

  for (const [variantName, variantType] of Object.entries(type.variants)) {
    unsafeDecode(variantType as types.Type, value, options).match(
      (value) => {
        decodedValue = value
        hasDecoded = true
      },
      (errors) => {
        encounteredError = true
        decodingErrors.push(...errors.map(prependToPath(`${variantName}`)))
      },
    )

    if (hasDecoded) {
      return succeed(decodedValue)
    } else if (options.errorReportingStrategy === 'stopAtFirstError' && encounteredError) {
      break
    }
  }
  return fail(decodingErrors)
}

function decodeTaggedUnion(type: types.UnionType<any>, value: unknown, options: Options): Result<any> {
  if (typeof value === 'object' && value) {
    const object = value as Record<string, any>
    const variantName = singleKeyFromObject(object)
    if (variantName !== undefined && Object.keys(type.variants).includes(variantName)) {
      const decodingResult = unsafeDecode(type.variants[variantName], object[variantName], options)
      return decodingResult.mapError((errors) => errors.map(prependToPath(variantName)))
    }
  }
  const prettyVariants = Object.keys(type.variants).join(', ')
  return baseFail(`union (${prettyVariants})`, value)
}

/**
 * @param object the object from which to extract a single key
 * @returns the key of the object if it has exactly one key; otherwise, it returns `undefined`
 */
function singleKeyFromObject(object: object): string | undefined {
  const keys = Object.keys(object)
  return keys.length === 1 ? keys[0] : undefined
}

function decodeObject(type: types.ObjectType<any, any>, value: unknown, options: Options): Result<any> {
  return castToObject(value).then((object) => decodeObjectProperties(type, object, options))
}

function castToObject(value: unknown): Result<Record<string, unknown>> {
  return typeof value === 'object' ? succeed(value as Record<string, unknown>) : baseFail('object', value)
}

function decodeObjectProperties(
  type: types.ObjectType<any, any>,
  object: Record<string, unknown>,
  options: Options,
): Result<any> {
  const decodingErrors: Error[] = []
  const decodedObject: { [key: string]: unknown } = {} // strict ? {} : { ...value }
  let encounteredError = false
  for (const [fieldName, fieldType] of Object.entries(type.types)) {
    unsafeDecode(fieldType as types.Type, object[fieldName], options).match(
      (decodedField) => {
        if (decodedField !== undefined) {
          decodedObject[fieldName] = decodedField
        }
      },
      (errors) => {
        encounteredError = true
        decodingErrors.push(...errors.map(prependToPath(fieldName)))
      },
    )
    if (options.errorReportingStrategy === 'stopAtFirstError' && encounteredError) {
      break
    }
  }
  return encounteredError ? fail(decodingErrors) : succeed(decodedObject)
}
