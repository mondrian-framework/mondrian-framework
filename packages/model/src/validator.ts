import { types, result, validator, path } from './index'
import { always, assertNever, failWithInternalError, mergeArrays } from './utils'

export type Options = {
  errorReportingStrategy: 'allErrors' | 'stopAtFirstError'
}

export const defaultOptions: Options = {
  errorReportingStrategy: 'stopAtFirstError',
}

/**
 * The result of the validation process, it could either be `true` in case of success or
 * a list of `validator.Error` in case of failure.
 */
export type Result = result.Result<true, Error[]>

/**
 * TODO: add doc
 */
export type Error = path.WithPath<{
  assertion: string
  got: unknown
}>

/**
 * The value returned by a succeeding validation process.
 */
export const succeed: () => Result = () => result.ok(true)

/**
 * @param errors the errors that made the validation process fail
 * @returns a `validator.Result` that fails with the given array of errors
 */
export const failWithErrors = (errors: Error[]): Result => result.fail(errors)

/**
 * @param assertion the assertion that failed
 * @param got the actual value that couldn't be validated
 * @returns a `validator.Result` that fails with a single error with an empty path and the provided
 *          `assertion` and `got` values
 */
export const fail = (assertion: string, got: unknown): Result =>
  failWithErrors([{ assertion, got, path: path.empty() }])

/**
 * @param type the {@link Type type} to define the validation logic
 * @param value the value of the type to validate
 * @param options the {@link Options `Options`} used to perform the validation
 * @returns a successful result with the validated value if it respects the type validation logic
 */
export function validate<T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  options?: Partial<validator.Options>,
): validator.Result {
  const actualOptions = { ...defaultOptions, ...options }
  return internalValidate(type, value, actualOptions)
}

function internalValidate<T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  options: validator.Options,
): validator.Result {
  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case types.Kind.Boolean:
    case types.Kind.Enum:
    case types.Kind.Literal:
      return validator.succeed()
    case types.Kind.Number:
      return validateNumber(concreteType, value as any)
    case types.Kind.String:
      return validateString(concreteType, value as any)
    case types.Kind.Optional:
      return validateOptional(concreteType, value as any, options)
    case types.Kind.Nullable:
      return validateNullable(concreteType, value as any, options)
    case types.Kind.Object:
      return validateObject(concreteType, value as any, options)
    case types.Kind.Union:
      return validateUnion(concreteType, value as any, options)
    case types.Kind.Array:
      return validateArray(concreteType, value as any, options)
    case types.Kind.Reference:
      return validateReference(concreteType, value as any, options)
    case types.Kind.Custom:
      return concreteType.validate(value, options, concreteType.options)
    default:
      assertNever(concreteType, 'Totality check failed when validating a value, this should have never happened')
  }
}

function validateNumber(type: types.NumberType, value: number): validator.Result {
  if (type.options === undefined) {
    return validator.succeed()
  }
  const { maximum, minimum, exclusiveMaximum, exclusiveMinimum, isInteger } = type.options
  if (maximum && !(value <= maximum)) {
    return validator.fail(`number must be less than or equal to ${maximum}`, value)
  } else if (exclusiveMaximum && !(value < exclusiveMaximum)) {
    return validator.fail(`number must be less than to ${exclusiveMaximum}`, value)
  } else if (minimum && !(value >= minimum)) {
    return validator.fail(`number must be greater than or equal to ${minimum}`, value)
  } else if (exclusiveMinimum && !(value > exclusiveMinimum)) {
    return validator.fail(`number must be greater than ${exclusiveMinimum}`, value)
  } else if (isInteger && !Number.isInteger(value)) {
    return validator.fail(`number must be an integer`, value)
  } else {
    return validator.succeed()
  }
}

function validateString(type: types.StringType, value: string): validator.Result {
  if (type.options === undefined) {
    return validator.succeed()
  }
  const { regex, maxLength, minLength } = type.options
  if (maxLength && value.length > maxLength) {
    return validator.fail(`string longer than max length (${maxLength})`, value)
  }
  if (minLength && value.length < minLength) {
    return validator.fail(`string shorter than min length (${minLength})`, value)
  }
  if (regex && !regex.test(value)) {
    return validator.fail(`string regex mismatch (${regex.source})`, value)
  }
  return validator.succeed()
}

function validateOptional<T extends types.Type>(
  type: types.OptionalType<T>,
  value: types.Infer<types.OptionalType<T>>,
  options: validator.Options,
): validator.Result {
  return value === undefined ? validator.succeed() : internalValidate(type.wrappedType, value, options)
}

function validateNullable<T extends types.Type>(
  type: types.NullableType<T>,
  value: types.Infer<types.NullableType<T>>,
  options: validator.Options,
): validator.Result {
  return value === null ? validator.succeed() : internalValidate(type.wrappedType, value, options)
}

function validateObject<Ts extends types.Types>(
  type: types.ObjectType<any, Ts>,
  object: types.Infer<types.ObjectType<any, Ts>>,
  options: validator.Options,
): validator.Result {
  const validateEntry = ([fieldName, fieldValue]: [string, unknown]) =>
    internalValidate(type.fields[fieldName], fieldValue as never, options).mapError((errors) =>
      path.prependFieldToAll(errors, fieldName),
    )

  const entries = Object.entries(object)
  return options.errorReportingStrategy === 'stopAtFirstError'
    ? result.tryEachFailFast(entries, true, always(true), validateEntry)
    : result.tryEach(entries, true, always(true), [] as validator.Error[], mergeArrays, validateEntry)
}

function and(options: validator.Options, result: validator.Result, other: () => validator.Result): validator.Result {
  if (!result.isOk) {
    if (options.errorReportingStrategy === 'stopAtFirstError') {
      return result
    } else {
      const otherErrors = other().match(
        () => [],
        (errors) => errors,
      )
      return validator.failWithErrors([...result.error, ...otherErrors])
    }
  } else {
    return other()
  }
}

function validateArray<T extends types.Type>(
  type: types.ArrayType<any, T>,
  value: types.Infer<types.ArrayType<any, T>>,
  options: validator.Options,
): validator.Result {
  const { maxItems, minItems } = type.options ?? {}
  const maxLengthMessage = `array must have at most ${maxItems} items`
  const minLengthMessage = `array must have at least ${minItems} items`
  const maxLengthValidation =
    maxItems && value.length > maxItems ? validator.fail(maxLengthMessage, value) : validator.succeed()
  const minLengthValidation =
    minItems && value.length < minItems ? validator.fail(minLengthMessage, value) : validator.succeed()

  // prettier-ignore
  return and(options, maxLengthValidation,
    () => and(options, minLengthValidation,
      () => validateArrayElements(type, value, options),
    ),
  )
}

function validateArrayElements<T extends types.Type>(
  type: types.ArrayType<any, T>,
  array: types.Infer<types.ArrayType<any, T>>,
  options: validator.Options,
): validator.Result {
  const validateItem = (item: types.Infer<T>, index: number) =>
    internalValidate(type.wrappedType, item, options).mapError((errors) => path.prependIndexToAll(errors, index))
  return options.errorReportingStrategy === 'stopAtFirstError'
    ? result.tryEachFailFast(array, true, always(true), validateItem)
    : result.tryEach(array, true, always(true), [] as validator.Error[], mergeArrays, validateItem)
}

function validateReference<T extends types.Type>(
  type: types.ReferenceType<T>,
  value: types.Infer<types.ReferenceType<T>>,
  options: validator.Options,
): validator.Result {
  return internalValidate(type.wrappedType, value, options)
}

function validateUnion<Ts extends types.Types>(
  type: types.UnionType<Ts>,
  variant: types.Infer<types.UnionType<Ts>>,
  options: validator.Options,
): validator.Result {
  const failureMessage =
    "I tried to validate an object that is not a union's variant. This should have been prevented by the type system"
  const variantName = Object.keys(variant).at(0)
  if (variantName === undefined) {
    failWithInternalError(failureMessage)
  } else {
    const variantType = type.variants[variantName]
    if (variantType === undefined) {
      failWithInternalError(failureMessage)
    } else {
      const result = internalValidate(variantType, variant[variantName] as never, options)
      return result.mapError((errors) => path.prependVariantToAll(errors, variantName))
    }
  }
}
