import { Infer, LazyType, NumberType, StringType } from './type-system'
import { assertNever, lazyToType } from './utils'

export type DecodeResult<T> =
  | { pass: true; value: T }
  | { pass: false; errors: { path?: string; error: string; value: unknown }[] }

export function decode<const T extends LazyType>(
  type: T,
  value: unknown,
  opts?: { cast?: boolean },
): DecodeResult<Infer<T>> {
  const result = decodeInternal(type, value, opts?.cast ?? false)
  return enrichErrors(result, '') as DecodeResult<Infer<T>>
}

function success<T>(value: T): { pass: true; value: T } {
  return { pass: true, value }
}

function errors(errors: { path?: string; error: string; value: unknown }[]): {
  pass: false
  errors: { path?: string; error: string; value: unknown }[]
} {
  return { pass: false, errors }
}

function error(
  error: string,
  value: unknown,
): {
  pass: false
  errors: { path?: string; error: string; value: unknown }[]
} {
  return { pass: false, errors: [{ error, value }] }
}

function enrichErrors<T>(result: DecodeResult<T>, key: string): DecodeResult<T> {
  if (!result.pass) {
    return errors(result.errors.map((e) => ({ ...e, path: e.path != null ? `${key}/${e.path}` : `${key}/` })))
  }
  return result
}

function concat<T, K>(result: DecodeResult<T>, f: (v: T) => DecodeResult<K>): DecodeResult<K> {
  if (result.pass) {
    return f(result.value)
  }
  return result
}

function decodeInternal(type: LazyType, value: unknown, cast: boolean): DecodeResult<unknown> {
  const t = lazyToType(type)
  if (t.kind === 'string') {
    return concat(assertString(value, cast), (value) => checkStringOptions(value, t.opts))
  } else if (t.kind === 'number') {
    return concat(assertNumber(value, cast), (value) => checkNumberOptions(value, t.opts))
  } else if (t.kind === 'boolean') {
    return assertBoolean(value, cast)
  } else if (t.kind === 'null') {
    return assertNull(value, cast)
  } else if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return success(value)
    }
    const result = decodeInternal(t.type, value, cast)
    if (!result.pass) {
      return result.errors.length > 0 ? result : error(`Undefined expected`, value)
    }
    return { pass: true, value: result.value as any }
  } else if (t.kind === 'default-decorator') {
    if (value === undefined) {
      return { pass: true, value: t.opts.default }
    }
    const result = decodeInternal(t.type, value, cast)
    if (!result.pass) {
      return result
    }
    return { pass: true, value: result.value as any }
  } else if (t.kind === 'union-operator') {
    const errors: { path?: string; error: string; value: unknown }[] = []
    for (const u of t.types) {
      const result = decodeInternal(u, value, cast)
      if (result.pass) {
        return result
      }
      errors.push(...result.errors)
    }
    return { pass: false, errors }
  } else if (t.kind === 'object') {
    if (typeof value !== 'object' || !value) {
      return error(`Object expected`, value)
    }
    const obj = value as Record<string, unknown>
    const ret: Record<string, unknown> = t.opts?.strict === false ? {} : { ...value }
    for (const [key, subtype] of Object.entries(t.type)) {
      const result = decodeInternal(subtype, obj[key], cast)
      const enrichedResult = enrichErrors(result, key)
      if (!enrichedResult.pass) {
        return enrichedResult
      }
      ret[key] = enrichedResult.value
    }
    return { pass: true, value: ret }
  } else if (t.kind === 'array-decorator') {
    if (!Array.isArray(value)) {
      return error(`Array expected`, value)
    }
    const values: unknown[] = []
    for (let i = 0; i < value.length; i++) {
      const result = decodeInternal(t.type, value[i], cast)
      const enrichedResult = enrichErrors(result, i.toString())
      if (!enrichedResult.pass) {
        return enrichedResult
      }
      values.push(enrichedResult.value)
    }
    return { pass: true, value: values }
  } else if (t.kind === 'enumerator') {
    if (typeof value !== 'string' || !t.values.includes(value)) {
      return error(`Enumerator expected (${t.values.map((v) => `"${v}"`).join(' | ')})`, value)
    }
    return success(value)
  } else if (t.kind === 'custom') {
    if (!t.is(value, t.opts)) {
      const result = t.decode(value, t.opts)
      if (!result.pass) {
        return result
      }
      return result
    }
    return success(value)
  } else {
    assertNever(t)
  }
}

function assertString(value: unknown, cast: boolean): DecodeResult<string> {
  if (typeof value === 'string') {
    return success(value)
  }
  if (cast) {
    if (typeof value === 'number') {
      return success(value.toString())
    }
    if (typeof value === 'boolean') {
      return success(value ? "true" : "false")
    }
  }
  return error(`String expected`, value)
}

function checkStringOptions(value: string, opts: StringType['opts']): DecodeResult<string> {
  if (opts?.maxLength != null && value.length > opts.maxLength) {
    return error(`String longer than max length (${value.length}/${opts.maxLength})`, value)
  }
  if (opts?.minLength != null && value.length < opts.minLength) {
    return error(`String shorter than min length (${value.length}/${opts.minLength})`, value)
  }
  if (opts?.regex != null && !opts.regex.test(value)) {
    return error(`String regex mismatch (${opts.regex.source})`, value)
  }
  return success(value)
}

function assertNumber(value: unknown, cast: boolean): DecodeResult<number> {
  if (typeof value === 'number') {
    return success(value)
  }
  if (cast) {
    const v = Number(value)
    if (!Number.isNaN(v)) {
      return success(v)
    }
  }
  return error(`Number expected`, value)
}

function checkNumberOptions(value: number, opts: NumberType['opts']): DecodeResult<number> {
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
  return success(value)
}

function assertBoolean(value: unknown, cast: boolean): DecodeResult<boolean> {
  if (typeof value === 'boolean') {
    return success(value)
  }
  if (cast) {
    if (typeof value === 'number') {
      return success(value ? true : false)
    }
    if (typeof value === 'string') {
      return success(value ? true : false)
    }
  }
  return error(`Boolean expected`, value)
}

function assertNull(value: unknown, cast: boolean): DecodeResult<null> {
  if (value === null) {
    return success(value)
  }
  return error(`Null expected`, value)
}
