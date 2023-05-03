import { ArrayDecorator, Infer, LazyType, NumberType, ObjectType, StringType, TupleDecorator } from './type-system'
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

function concat2<V1, V2>(v1: DecodeResult<V1>, f1: (v: V1) => DecodeResult<V2>): DecodeResult<V2> {
  if (!v1.pass) {
    return v1
  }
  const v2 = f1(v1.value)
  return v2
}
function concat3<V1, V2, V3>(
  v1: DecodeResult<V1>,
  f1: (v: V1) => DecodeResult<V2>,
  f2: (v: V2) => DecodeResult<V3>,
): DecodeResult<V3> {
  if (!v1.pass) {
    return v1
  }
  const v2 = f1(v1.value)
  if (!v2.pass) {
    return v2
  }
  const v3 = f2(v2.value)
  return v3
}

function decodeInternal(type: LazyType, value: unknown, cast: boolean): DecodeResult<unknown> {
  const t = lazyToType(type)
  if (t.kind === 'string') {
    return concat2(assertString(value, cast), (value) => checkStringOptions(value, t.opts))
  } else if (t.kind === 'number') {
    return concat2(assertNumber(value, cast), (value) => checkNumberOptions(value, t.opts))
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
    return result
  } else if (t.kind === 'default-decorator') {
    if (value === undefined) {
      return success(t.opts.default)
    }
    return decodeInternal(t.type, value, cast)
  } else if (t.kind === 'union-operator') {
    const errs: { path?: string; error: string; value: unknown }[] = []
    for (const u of t.types) {
      const result = decodeInternal(u, value, cast)
      if (result.pass) {
        return result
      }
      errs.push(...result.errors)
    }
    return errors(errs)
  } else if (t.kind === 'object') {
    return concat3(
      assertObject(value, cast),
      (value) => checkObjectOptions(value, t.opts),
      ({ value, accumulator }) => decodeObjectProperties(value, t, accumulator, cast),
    )
  } else if (t.kind === 'array-decorator') {
    return concat3(
      assertArray(value, cast),
      (value) => checkArrayOptions(value, t.opts),
      (value) => decodeArrayElements(value, t, cast),
    )
  } else if (t.kind === 'name-decorator') {
    return decodeInternal(t.type, value, cast)
  } else if (t.kind === 'tuple-decorator') {
    return concat2(assertArray(value, cast), (value) => decodeTupleElements(value, t, cast))
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
  }
  assertNever(t)
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
      return success(value ? 'true' : 'false')
    }
  }
  return error(`String expected`, value)
}

function assertObject(value: unknown, cast: boolean): DecodeResult<Record<string, unknown>> {
  if (typeof value !== 'object' || !value) {
    return error(`Object expected`, value)
  }
  return success(value as Record<string, unknown>)
}

function checkObjectOptions(
  value: Record<string, unknown>,
  opts: ObjectType['opts'],
): DecodeResult<{ value: Record<string, unknown>; accumulator: Record<string, unknown> }> {
  if (opts?.strict) {
    return success({ value, accumulator: {} })
  }
  return success({ value, accumulator: { ...value } })
}

function decodeObjectProperties(
  value: Record<string, unknown>,
  type: ObjectType,
  accumulator: Record<string, unknown>,
  cast: boolean,
): DecodeResult<Record<string, unknown>> {
  for (const [key, subtype] of Object.entries(type.type)) {
    const result = decodeInternal(subtype, value[key], cast)
    const enrichedResult = enrichErrors(result, key)
    if (!enrichedResult.pass) {
      return enrichedResult
    }
    if (enrichedResult.value !== undefined) {
      accumulator[key] = enrichedResult.value
    }
  }
  return success(accumulator)
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

function assertArray(value: unknown, cast: boolean): DecodeResult<unknown[]> {
  if (Array.isArray(value)) {
    return success(value)
  }
  if (cast && typeof value === 'object' && value) {
    // { 0: "a", 1: "b" } -> ["a", "b"]
    const keys = Object.keys(value)
    if (keys.some((v) => Number.isNaN(Number(v)))) {
      return error(`Array expected`, value)
    }
    const array: unknown[] = []
    for (let i = 0; i < keys.length; i++) {
      const index = Number(keys[i])
      if (index !== i) {
        return error(`Array expected`, value)
      }
      array.push((value as Record<string, unknown>)[keys[i]])
    }
    if (array.length === keys.length) {
      return success(array)
    }
  }
  return error(`Array expected`, value)
}

function checkArrayOptions(value: unknown[], opts: ArrayDecorator['opts']): DecodeResult<unknown[]> {
  if (opts?.maxItems != null && value.length > opts.maxItems) {
    return error(`Array must have maximum ${opts.maxItems} items`, value)
  }
  return success(value)
}

function decodeArrayElements(value: unknown[], type: ArrayDecorator, cast: boolean): DecodeResult<unknown[]> {
  const values: unknown[] = []
  for (let i = 0; i < value.length; i++) {
    const result = decodeInternal(type.type, value[i], cast)
    const enrichedResult = enrichErrors(result, i.toString())
    if (!enrichedResult.pass) {
      return enrichedResult
    }
    values.push(enrichedResult.value)
  }
  return success(values)
}

function decodeTupleElements(value: unknown[], type: TupleDecorator, cast: boolean): DecodeResult<unknown[]> {
  const values: unknown[] = []
  if (type.types.length !== value.length) {
    if (value.length < type.types.length || !cast) {
      return error(`Tuple expects ${type.types.length} elements, but obly got ${value.length}`, value)
    }
  }
  for (let i = 0; i < type.types.length; i++) {
    const result = decodeInternal(type.types[i], value[i], cast)
    const enrichedResult = enrichErrors(result, i.toString())
    if (!enrichedResult.pass) {
      return enrichedResult
    }
    values.push(enrichedResult.value)
  }
  return success(values)
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
