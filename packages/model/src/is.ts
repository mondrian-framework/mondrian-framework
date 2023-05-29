import { assertNever } from '@mondrian-framework/utils'
import { ArrayDecorator, LazyType, NumberType, ObjectType, StringType } from './type-system'
import { lazyToType } from './utils'

export type IsResult =
  | { success: true }
  | { success: false; errors: { path?: string; error: string; value: unknown }[] }

function success(): { success: true } {
  return { success: true }
}

function concat2<V1>(v1: IsResult, f1: () => IsResult): IsResult {
  if (!v1.success) {
    return v1
  }
  const v2 = f1()
  return v2
}

function enrichErrors<T>(result: IsResult, key: string): IsResult {
  if (!result.success) {
    return errors(result.errors.map((e) => ({ ...e, path: e.path != null ? `${key}/${e.path}` : `${key}/` })))
  }
  return result
}

export function errors(errors: { path?: string; error: string; value: unknown }[]): {
  success: false
  errors: { path?: string; error: string; value: unknown }[]
} {
  return { success: false, errors }
}

export function error(
  error: string,
  value: unknown,
): {
  success: false
  errors: { path?: string; error: string; value: unknown }[]
} {
  return { success: false, errors: [{ error, value }] }
}

export function is(type: LazyType, value: unknown): IsResult {
  const result = isInternal(type, value)
  return enrichErrors(result, '')
}

function isInternal(type: LazyType, value: unknown): IsResult {
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
    if (typeof value !== 'number') {
      return error(`Boolean expected`, value)
    }
    return success()
  }
  if (t.kind === 'literal') {
    if (value === t.value) {
      return success()
    }
    return error(`Literal ${t.value} expected`, value)
  }
  if (t.kind === 'relation-decorator' || t.kind === 'default-decorator') {
    return isInternal(t.type, value)
  }
  if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return success()
    }
    const result = isInternal(t.type, value)
    if (!result.success) {
      return result.errors.length > 0 ? result : error(`Undefined expected`, value)
    }
    return result
  }
  if (t.kind === 'nullable-decorator') {
    if (value === null) {
      return success()
    }
    const result = isInternal(t.type, value)
    if (!result.success) {
      return result.errors.length > 0 ? result : error(`Null expected`, value)
    }
    return result
  }
  if (t.kind === 'array-decorator') {
    if (!Array.isArray(value)) {
      return error(`Array expected`, value)
    }
    return concat2(checkArrayOptions(value, t.opts), () => arrayElementIs(value, t))
  }
  if (t.kind === 'enum') {
    if (typeof value !== 'string' || !t.values.includes(value)) {
      return error(`Enumerator expected (${t.values.map((v) => `"${v}"`).join(' | ')})`, value)
    }
    return success()
  }
  if (t.kind === 'object') {
    if (typeof value !== 'object' || !value) {
      return error(`Object expected`, value)
    }
    for (const [key, subtype] of Object.entries(t.type)) {
      const result = isInternal(subtype as LazyType, (value as Record<string, unknown>)[key])
      const enrichedResult = enrichErrors(result, key)
      if (!enrichedResult.success) {
        return enrichedResult
      }
    }
    return success()
  }
  if (t.kind === 'union-operator') {
    const errs: { path?: string; error: string; value: unknown }[] = []
    for (const u of Object.values(t.types)) {
      const result = isInternal(u, value)
      if (result.success) {
        return result
      }
      errs.push(...result.errors)
    }
    return errors(errs)
  }
  if (t.kind === 'custom') {
    return t.is(value, t.opts)
  }
  assertNever(t)
}

function checkStringOptions(value: string, opts: StringType['opts']): IsResult {
  if (opts?.maxLength != null && value.length > opts.maxLength) {
    return error(`String longer than max length (${opts.maxLength})`, value)
  }
  if (opts?.minLength != null && value.length < opts.minLength) {
    return error(`String shorter than min length (${opts.minLength})`, value)
  }
  if (opts?.regex != null && !opts.regex.test(value)) {
    return error(`String regex misInternalmatch (${opts.regex.source})`, value)
  }
  return success()
}

function checkNumberOptions(value: number, opts: NumberType['opts']): IsResult {
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
  return success()
}

function checkArrayOptions(value: unknown[], opts: ArrayDecorator['opts']): IsResult {
  if (opts?.maxItems != null && value.length > opts.maxItems) {
    return error(`Array must have maximum ${opts.maxItems} items`, value)
  }
  return success()
}

function arrayElementIs(value: unknown[], type: ArrayDecorator): IsResult {
  for (let i = 0; i < value.length; i++) {
    const result = isInternal(type.type, value[i])
    const enrichedResult = enrichErrors(result, i.toString())
    if (!enrichedResult.success) {
      return enrichedResult
    }
  }
  return success()
}
