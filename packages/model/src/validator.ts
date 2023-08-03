import { types, result, validator, path } from './index'
import { match } from 'ts-pattern'

/* TODO: figure out how to deal with object strictness */
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
export type Error = {
  assertion: string
  got: unknown
  path: path.Path
}

/**
 * Utility function to prepend a prefix to the path of a `validator.Error`.
 */
function prependFieldToPath(fieldName: string): (error: Error) => Error {
  return (error: Error) => ({ ...error, path: error.path.prependField(fieldName) })
}

/**
 * Utility function to prepend an index to the path of a `validator.Error`.
 */
function prependIndexToPath(index: number): (error: Error) => Error {
  return (error: Error) => ({ ...error, path: error.path.prependIndex(index) })
}

/**
 * Utility function to prepend a variant to the path of a `validator.Error`.
 */
function prependVariantToPath(variantName: string): (error: Error) => Error {
  return (error: Error) => ({ ...error, path: error.path.prependVariant(variantName) })
}

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
  return match(types.concretise(type))
    .with({ kind: 'boolean' }, (_) => validator.succeed())
    .with({ kind: 'enum' }, (_) => validator.succeed())
    .with({ kind: 'literal' }, (_) => validator.succeed())
    .with({ kind: 'number' }, (type) => validateNumber(type, value as any))
    .with({ kind: 'string' }, (type) => validateString(type, value as any))
    .with({ kind: 'optional' }, (type) => validateOptional(type, value as any, options))
    .with({ kind: 'nullable' }, (type) => validateNullable(type, value as any, options))
    .with({ kind: 'object' }, (type) => validateObject(type, value as any, options))
    .with({ kind: 'union' }, (type) => validateUnion(type, value as any, options))
    .with({ kind: 'array' }, (type) => validateArray(type, value as any, options))
    .with({ kind: 'reference' }, (type) => validateReference(type, value as any, options))
    .with({ kind: 'custom' }, (type) => type.validate(value, options, type.options))
    .exhaustive()
}

function validateNumber(type: types.NumberType, value: number): validator.Result {
  if (type.options === undefined) {
    return validator.succeed()
  }
  const { inclusiveMaximum, inclusiveMinimum, exclusiveMaximum, exclusiveMinimum, multipleOf } = type.options
  if (inclusiveMaximum && !(value <= inclusiveMaximum)) {
    return validator.fail(`number must be less than or equal to ${inclusiveMaximum}`, value)
  } else if (exclusiveMaximum && !(value < exclusiveMaximum)) {
    return validator.fail(`number must be less than to ${exclusiveMaximum}`, value)
  } else if (inclusiveMinimum && !(value >= inclusiveMinimum)) {
    return validator.fail(`number must be greater than or equal to ${inclusiveMinimum}`, value)
  } else if (exclusiveMinimum && !(value > exclusiveMinimum)) {
    return validator.fail(`number must be greater than ${exclusiveMinimum}`, value)
  } else if (multipleOf && value % multipleOf !== 0) {
    return validator.fail(`number must be mutiple of ${multipleOf}`, value)
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
  value: types.Infer<types.ObjectType<any, Ts>>,
  options: validator.Options,
): validator.Result {
  const validationErrors: validator.Error[] = []
  let encounteredError = false
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    internalValidate(type.types[fieldName], fieldValue as never, options).match(
      (_) => {},
      (errors) => {
        encounteredError = true
        validationErrors.push(...errors.map(prependFieldToPath(fieldName)))
      },
    )
    if (encounteredError && options.errorReportingStrategy === 'stopAtFirstError') {
      break
    }
  }
  return encounteredError ? validator.failWithErrors(validationErrors) : validator.succeed()
  /* TODO see what to do with object strictness
  if (strict) {
      for (const [key, subvalue] of Object.entries(value)) {
        if (!(key in t.type) && subvalue !== undefined) {
          errs.push(richError(`Value not expected`, subvalue, key))
          if (errorLevel === 'minimum') {
            break
          }
        }
      }
    }
   */
}

function validateArray<T extends types.Type>(
  type: types.ArrayType<any, T>,
  value: types.Infer<types.ArrayType<any, T>>,
  options: validator.Options,
): validator.Result {
  if (type.options === undefined) {
    return validator.succeed()
  }
  const { maxItems, minItems } = type.options
  if (maxItems && value.length > maxItems) {
    return validator.fail(`array must have at most ${maxItems} items`, value)
  }
  if (minItems && value.length < minItems) {
    return validator.fail(`array must have at least ${minItems} items`, value)
  }
  return validateArrayElements(type, value, options)
}

function validateArrayElements<T extends types.Type>(
  type: types.ArrayType<any, T>,
  value: types.Infer<types.ArrayType<any, T>>,
  options: validator.Options,
): validator.Result {
  const validationErrors: validator.Error[] = []
  let encounteredError = false
  for (let i = 0; i < value.length; i++) {
    internalValidate(type.wrappedType, value[i], options).match(
      (_) => {},
      (errors) => {
        encounteredError = true
        validationErrors.push(...errors.map(prependIndexToPath(i)))
      },
    )
    if (encounteredError && options.errorReportingStrategy === 'stopAtFirstError') {
      break
    }
  }
  return encounteredError ? validator.failWithErrors(validationErrors) : validator.succeed()
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
  value: types.Infer<types.UnionType<Ts>>,
  options: validator.Options,
): validator.Result {
  let encounteredError = false
  for (const [variantName, variantType] of Object.entries(type.variants)) {
    const variantCheck = type.variantsChecks?.[variantName]
    // If the variant can be decoded as one of the variants
    const valueIsVariant = variantCheck && variantCheck(value)
    if (valueIsVariant) {
      const validationErrors: Error[] = []
      internalValidate(variantType, value as never, options).match(
        (_) => {},
        (errors) => {
          encounteredError = true
          validationErrors.push(...errors.map(prependVariantToPath(variantName)))
        },
      )
      return encounteredError ? validator.succeed() : validator.failWithErrors(validationErrors)
    }
  }
  return validator.fail('value does not pass any of the variant checks', value)
}
