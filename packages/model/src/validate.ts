import { Error, Result, concat2, enrichErrors, error, errors, richError, success } from './result'
import { ArrayDecorator, Infer, LazyType, NumberType, StringType } from './type-system'
import { lazyToType } from './utils'
import { assertNever } from '@mondrian-framework/utils'

export function isType<T extends LazyType>(type: T, value: unknown): value is Infer<T> {
  return validate(type, value).success
}

export function assertType<T extends LazyType>(type: T, value: unknown): asserts value is Infer<T> {
  const result = validate(type, value)
  if (!result.success) {
    throw new Error(`Invalid type: ${JSON.stringify(result.errors)}`)
  }
}

export type ValidateOptions = { errors?: 'exhaustive' | 'minimum'; strict?: boolean }
export function validate<T extends LazyType>(type: T, value: unknown, opts?: ValidateOptions): Result<Infer<T>> {
  const result = validateInternal(type, value, opts)
  return enrichErrors(result) as Result<Infer<T>>
}

function validateInternal(type: LazyType, value: unknown, opts: ValidateOptions | undefined): Result<unknown> {
  const t = lazyToType(type)
  if (t.kind === 'string') {
    if (typeof value !== 'string') {
      return error(`String expected`, value)
    }
    return checkStringOptions(value, t.opts)
  }
  if (t.kind === 'number') {
    if (typeof value !== 'number') {
      return error(`Number expected`, value)
    }
    return checkNumberOptions(value, t.opts)
  }
  if (t.kind === 'boolean') {
    if (typeof value !== 'boolean') {
      return error(`Boolean expected`, value)
    }
    return success(value)
  }
  if (t.kind === 'literal') {
    if (value === t.value) {
      return success(value)
    }
    return error(`Literal ${t.value} expected`, value)
  }
  if (t.kind === 'relation-decorator' || t.kind === 'default-decorator') {
    return validateInternal(t.type, value, opts)
  }
  if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return success(value)
    }
    const result = validateInternal(t.type, value, opts)
    if (!result.success) {
      return result.errors.length > 0 ? result : error(`Undefined expected`, value)
    }
    return result
  }
  if (t.kind === 'nullable-decorator') {
    if (value === null) {
      return success(value)
    }
    const result = validateInternal(t.type, value, opts)
    if (!result.success) {
      return result.errors.length > 0 ? result : error(`Null expected`, value)
    }
    return result
  }
  if (t.kind === 'array-decorator') {
    if (!Array.isArray(value)) {
      return error(`Array expected`, value)
    }
    return concat2(checkArrayOptions(value, t.opts), () => validateArrayElements(value, t, opts))
  }
  if (t.kind === 'enum') {
    if (typeof value !== 'string' || !t.values.includes(value)) {
      return error(`Enumerator expected (${t.values.map((v) => `"${v}"`).join(' | ')})`, value)
    }
    return success(value)
  }
  if (t.kind === 'object') {
    if (typeof value !== 'object' || !value) {
      return error(`Object expected`, value)
    }
    const strict = opts?.strict ?? true
    const errorLevel = opts?.errors ?? 'minimum'
    const errs: Error[] = []
    for (const [key, subtype] of Object.entries(t.type)) {
      const result = validateInternal(subtype as LazyType, (value as Record<string, unknown>)[key], opts)
      const enrichedResult = enrichErrors(result, [key])
      if (!enrichedResult.success) {
        errs.push(...enrichedResult.errors)
        if (errorLevel === 'minimum') {
          break
        }
      }
    }
    if (errorLevel === 'minimum' && errs.length > 0) {
      return errors(errs)
    }
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
    if (errs.length > 0) {
      return errors(errs)
    }
    return success(value)
  }
  if (t.kind === 'union-operator') {
    const errs: { path?: string; error: string; value: unknown }[] = []
    for (const [key, u] of Object.entries(t.types)) {
      const result = validateInternal(u, value, opts)
      if (result.success) {
        return result
      }
      errs.push(...result.errors.map((e) => ({ ...e, unionElement: key })))
    }
    return errors(errs)
  }
  if (t.kind === 'custom') {
    return t.validate(value, t.opts)
  }
  assertNever(t)
}

function checkStringOptions(value: string, opts: StringType['opts']): Result<string> {
  if (opts?.maxLength != null && value.length > opts.maxLength) {
    return error(`String longer than max length (${opts.maxLength})`, value)
  }
  if (opts?.minLength != null && value.length < opts.minLength) {
    return error(`String shorter than min length (${opts.minLength})`, value)
  }
  if (opts?.regex != null && !opts.regex.test(value)) {
    return error(`String regex misInternalmatch (${opts.regex.source})`, value)
  }
  return success(value)
}

function checkNumberOptions(value: number, opts: NumberType['opts']): Result<number> {
  if (opts?.minimum != null && value < opts.minimum) {
    return error(`Number must be greater than or equal to ${opts.minimum}`, value)
  }
  if (opts?.maximum != null && value > opts.maximum) {
    return error(`Number must be less than or equal to ${opts.maximum}`, value)
  }
  if (opts?.exclusiveMinimum != null && value <= opts.exclusiveMinimum) {
    return error(`Number must be greater than ${opts.exclusiveMinimum}`, value)
  }
  if (opts?.exclusiveMaximum != null && value >= opts.exclusiveMaximum) {
    return error(`Number must be less than ${opts.exclusiveMaximum}`, value)
  }
  if (opts?.multipleOf != null && value % opts.multipleOf !== 0) {
    return error(`Number must be mutiple of ${opts.multipleOf}`, value)
  }
  return success(value)
}

function checkArrayOptions(value: unknown[], opts: ArrayDecorator['opts']): Result<unknown[]> {
  if (opts?.maxItems != null && value.length > opts.maxItems) {
    return error(`Array must have maximum ${opts.maxItems} items`, value)
  }
  return success(value)
}

function validateArrayElements(
  value: unknown[],
  type: ArrayDecorator,
  opts: ValidateOptions | undefined,
): Result<unknown[]> {
  const errs: Error[] = []
  const errorLevel = opts?.errors ?? 'minimum'
  for (let i = 0; i < value.length; i++) {
    const result = validateInternal(type.type, value[i], opts)
    const enrichedResult = enrichErrors(result, [i])
    if (!enrichedResult.success) {
      errs.push(...enrichedResult.errors)
      if (errorLevel === 'minimum') {
        break
      }
    }
  }
  if (errs.length > 0) {
    return errors(errs)
  }
  return success(value)
}
