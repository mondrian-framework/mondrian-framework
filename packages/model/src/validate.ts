import { types, result } from './index'
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
export function validate<T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  options?: OptionalFields<ValidationOptions>,
): result.Result<true> {
  const actualOptions = { ...defaultValidationOptions, ...options }
  const validationResult = internalValidate(type, value, actualOptions)
  return result.enrichErrors(validationResult)
}

function internalValidate<T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  options: ValidationOptions,
): result.Result<true> {
  return match(types.concretise(type))
    .with({ kind: 'boolean' }, (_) => result.success(true) as result.Result<true>)
    .with({ kind: 'enum' }, (_) => result.success(true) as result.Result<true>)
    .with({ kind: 'literal' }, (_) => result.success(true) as result.Result<true>)
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

function validateNumber(type: types.NumberType, value: number): result.Result<true> {
  if (type.options === undefined) {
    return result.success(true)
  }
  const { maximum, minimum, multipleOf } = type.options
  if (maximum) {
    const [bound, inclusivity] = maximum
    if (inclusivity === 'inclusive' && value > bound) {
      return result.error(`Number must be less than or equal to ${bound}`, value)
    } else if (inclusivity === 'exclusive' && value >= bound) {
      return result.error(`Number must be less than ${bound}`, value)
    }
  }
  if (minimum) {
    const [bound, inclusivity] = minimum
    if (inclusivity === 'inclusive' && value < bound) {
      return result.error(`Number must be greater than or equal to ${bound}`, value)
    } else if (inclusivity === 'exclusive' && value <= bound) {
      return result.error(`Number must be greater than ${bound}`, value)
    }
  }
  if (multipleOf && value % multipleOf !== 0) {
    return result.error(`Number must be mutiple of ${multipleOf}`, value)
  }
  return result.success(true)
}

function validateString(type: types.StringType, value: string): result.Result<true> {
  if (type.options === undefined) {
    return result.success(true)
  }
  const { regex, maxLength, minLength } = type.options
  if (maxLength && value.length > maxLength) {
    return result.error(`String longer than max length (${maxLength})`, value)
  }
  if (minLength && value.length < minLength) {
    return result.error(`String shorter than min length (${minLength})`, value)
  }
  if (regex && !regex.test(value)) {
    return result.error(`String regex mismatch (${regex.source})`, value)
  }
  return result.success(true)
}

function validateOptional<T extends types.Type>(
  type: types.OptionalType<T>,
  value: types.Infer<types.OptionalType<T>>,
  options: ValidationOptions,
): result.Result<true> {
  return value === undefined ? result.success(true) : internalValidate(type.wrappedType, value, options)
}

function validateNullable<T extends types.Type>(
  type: types.NullableType<T>,
  value: types.Infer<types.NullableType<T>>,
  options: ValidationOptions,
): result.Result<true> {
  return value === null ? result.success(true) : internalValidate(type.wrappedType, value, options)
}

function validateObject<Ts extends types.Types>(
  type: types.ObjectType<any, Ts>,
  value: types.Infer<types.ObjectType<any, Ts>>,
  options: ValidationOptions,
): result.Result<true> {
  const validationErrors: result.Error[] = []
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    const validationResult = internalValidate(type.types[fieldName], fieldValue as never, options)
    const enrichedResult = result.enrichErrors(validationResult, [fieldName])
    if (!enrichedResult.success) {
      validationErrors.push(...enrichedResult.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return validationErrors.length > 0 ? result.errors(validationErrors) : result.success(true)
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
  options: ValidationOptions,
): result.Result<true> {
  if (type.options === undefined) {
    return result.success(true)
  }
  const { maxItems, minItems } = type.options
  if (maxItems && value.length > maxItems) {
    return result.error(`Array must have at most ${maxItems} items`, value)
  }
  if (minItems && value.length < minItems) {
    return result.error(`Array must have at least ${minItems} items`, value)
  }
  return validateArrayElements(type, value, options)
}

function validateArrayElements<T extends types.Type>(
  type: types.ArrayType<any, T>,
  value: types.Infer<types.ArrayType<any, T>>,
  options: ValidationOptions,
): result.Result<true> {
  const validationErrors: result.Error[] = []
  for (let i = 0; i < value.length; i++) {
    const validationResult = internalValidate(type.wrappedType, value[i], options)
    if (!validationResult.success) {
      validationErrors.push(...validationResult.errors)
      if (options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
    }
  }
  return validationErrors.length > 0 ? result.errors(validationErrors) : result.success(true)
}

function validateReference<T extends types.Type>(
  type: types.ReferenceType<T>,
  value: types.Infer<types.ReferenceType<T>>,
  options: ValidationOptions,
): result.Result<true> {
  return internalValidate(type.wrappedType, value, options)
}

function validateUnion<Ts extends types.Types>(
  type: types.UnionType<Ts>,
  value: types.Infer<types.UnionType<Ts>>,
  options: ValidationOptions,
): result.Result<true> {
  const errs: { path?: string; error: string; value: unknown }[] = []
  for (const [key, u] of Object.entries(type.variants)) {
    const variantCheck = type.variantsChecks?.[key]
    if (variantCheck && !variantCheck(value)) {
      continue
    }
    const validationResult = internalValidate(u, value as never, options)
    if (validationResult.success) {
      return validationResult
    }
    errs.push(...validationResult.errors.map((e) => ({ ...e, unionElement: key })))
  }
  if (errs.length === 0) {
    return result.error('Value does not pass any variant check.', value)
  }
  return result.errors(errs)
}
