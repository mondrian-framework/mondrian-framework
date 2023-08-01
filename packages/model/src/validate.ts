import { Error, Result, enrichErrors, error, errors, success } from './result'
import {
  Type,
  Infer,
  NumberType,
  StringType,
  concretise,
  OptionalType,
  NullableType,
  ObjectType,
  Types,
  ReferenceType,
  ArrayType,
  UnionType,
} from './type-system'
import { OptionalFields } from './utils'
import { match } from 'ts-pattern'

/* TODO: figure out how to deal with object strictness */
export type ValidationOptions = {
  errorReportingStrategy: 'allErrors' | 'stopAtFirstError'
}

export const defaultValidationOptions: ValidationOptions = {
  errorReportingStrategy: 'stopAtFirstError',
}

/**
 * @param type the {@link Type type} to define the validation logic
 * @param value the value of the type to validate
 * @param options the {@link ValidationOptions `ValidationOptions`} used to perform the validation
 * @returns a successful result with the validated value if it respects the type validation logic
 */
export function validate<T extends Type>(
  type: T,
  value: Infer<T>,
  options?: OptionalFields<ValidationOptions>,
): Result<true> {
  const actualOptions = { ...defaultValidationOptions, ...options }
  const result = internalValidate(type, value, actualOptions)
  return enrichErrors(result)
}

function internalValidate<T extends Type>(type: T, value: Infer<T>, options: ValidationOptions): Result<true> {
  return match(concretise(type))
    .with({ kind: 'boolean' }, (_) => success(true) as Result<true>)
    .with({ kind: 'enum' }, (_) => success(true) as Result<true>)
    .with({ kind: 'literal' }, (_) => success(true) as Result<true>)
    .with({ kind: 'number' }, (type) => validateNumber(type, value as any))
    .with({ kind: 'string' }, (type) => validateString(type, value as any))
    .with({ kind: 'optional' }, (type) => validateOptional(type, value as any, options))
    .with({ kind: 'nullable' }, (type) => validateNullable(type, value as any, options))
    .with({ kind: 'object' }, (type) => validateObject(type, value as any, options))
    .with({ kind: 'union' }, (type) => validateUnion(type, value as any, options))
    .with({ kind: 'array' }, (type) => validateArray(type, value as any, options))
    .with({ kind: 'reference' }, (type) => validateReference(type, value as any, options))
    .with({ kind: 'custom' }, (type) => type.validate(value, type.options, options))
    .exhaustive()
}

function validateNumber(type: NumberType, value: number): Result<true> {
  if (type.options === undefined) {
    return success(true)
  }
  const { maximum, minimum, multipleOf } = type.options
  if (maximum) {
    const [bound, inclusivity] = maximum
    if (inclusivity === 'inclusive' && value > bound) {
      return error(`Number must be less than or equal to ${bound}`, value)
    } else if (inclusivity === 'exclusive' && value >= bound) {
      return error(`Number must be less than ${bound}`, value)
    }
  }
  if (minimum) {
    const [bound, inclusivity] = minimum
    if (inclusivity === 'inclusive' && value < bound) {
      return error(`Number must be greater than or equal to ${bound}`, value)
    } else if (inclusivity === 'exclusive' && value <= bound) {
      return error(`Number must be greater than ${bound}`, value)
    }
  }
  if (multipleOf && value % multipleOf !== 0) {
    return error(`Number must be mutiple of ${multipleOf}`, value)
  }
  return success(true)
}

function validateString(type: StringType, value: string): Result<true> {
  if (type.options === undefined) {
    return success(true)
  }
  const { regex, maxLength, minLength } = type.options
  if (maxLength && value.length > maxLength) {
    return error(`String longer than max length (${maxLength})`, value)
  }
  if (minLength && value.length < minLength) {
    return error(`String shorter than min length (${minLength})`, value)
  }
  if (regex && !regex.test(value)) {
    return error(`String regex mismatch (${regex.source})`, value)
  }
  return success(true)
}

function validateOptional<T extends Type>(
  type: OptionalType<T>,
  value: Infer<OptionalType<T>>,
  options: ValidationOptions,
): Result<true> {
  return value === undefined ? success(true) : internalValidate(type.wrappedType, value, options)
}

function validateNullable<T extends Type>(
  type: NullableType<T>,
  value: Infer<NullableType<T>>,
  options: ValidationOptions,
): Result<true> {
  return value === null ? success(true) : internalValidate(type.wrappedType, value, options)
}

function validateObject<Ts extends Types>(
  type: ObjectType<any, Ts>,
  value: Infer<ObjectType<any, Ts>>,
  options: ValidationOptions,
): Result<true> {
  const validationErrors: Error[] = []
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    const result = internalValidate(type.types[fieldName], fieldValue as never, options)
    const enrichedResult = enrichErrors(result, [fieldName])
    if (!enrichedResult.success) {
      validationErrors.push(...enrichedResult.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return validationErrors.length > 0 ? errors(validationErrors) : success(true)
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

function validateArray<T extends Type>(
  type: ArrayType<any, T>,
  value: Infer<ArrayType<any, T>>,
  options: ValidationOptions,
): Result<true> {
  if (type.options === undefined) {
    return success(true)
  }
  const { maxItems, minItems } = type.options
  if (maxItems && value.length > maxItems) {
    return error(`Array must have at most ${maxItems} items`, value)
  }
  if (minItems && value.length < minItems) {
    return error(`Array must have at least ${minItems} items`, value)
  }
  return validateArrayElements(type, value, options)
}

function validateArrayElements<T extends Type>(
  type: ArrayType<any, T>,
  value: Infer<ArrayType<any, T>>,
  options: ValidationOptions,
): Result<true> {
  const validationErrors: Error[] = []
  for (let i = 0; i < value.length; i++) {
    const result = internalValidate(type.wrappedType, value[i], options)
    if (!result.success) {
      validationErrors.push(...result.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return validationErrors.length > 0 ? errors(validationErrors) : success(true)
}

function validateReference<T extends Type>(
  type: ReferenceType<T>,
  value: Infer<ReferenceType<T>>,
  options: ValidationOptions,
): Result<true> {
  return internalValidate(type.wrappedType, value, options)
}

function validateUnion<Ts extends Types>(
  type: UnionType<Ts>,
  value: Infer<UnionType<Ts>>,
  options: ValidationOptions,
): Result<true> {
  const errs: { path?: string; error: string; value: unknown }[] = []
  for (const [key, u] of Object.entries(type.variants)) {
    const variantCheck = type.variantsChecks?.[key]
    if (variantCheck && !variantCheck(value)) {
      continue
    }
    const result = internalValidate(u, value as never, options)
    if (result.success) {
      return result
    }
    errs.push(...result.errors.map((e) => ({ ...e, unionElement: key })))
  }
  if (errs.length === 0) {
    return error('Value does not pass any variant check.', value)
  }
  return errors(errs)
}
