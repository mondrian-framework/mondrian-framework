import { Result, concat2, enrichErrors, error, errors, success } from './result'
import { ArrayDecorator, Infer, LazyType, ObjectType } from './type-system'
import { lazyToType } from './utils'
import { assertNever } from '@mondrian-framework/utils'

//cast default is false
//strict default is true
export type DecodeOptions = { cast?: boolean; strict?: boolean; castGqlInputUnion?: boolean }
export function decode<const T extends LazyType>(type: T, value: unknown, opts?: DecodeOptions): Result<unknown> {
  const result = decodeInternal(type, value, opts)
  return enrichErrors(result, '')
}

function decodeInternal(type: LazyType, value: unknown, opts: DecodeOptions | undefined): Result<unknown> {
  const t = lazyToType(type)
  if (t.kind === 'string') {
    return assertString(value, opts)
  } else if (t.kind === 'number') {
    return assertNumber(value, opts)
  } else if (t.kind === 'boolean') {
    return assertBoolean(value, opts)
  } else if (t.kind === 'literal') {
    if (value === t.value) {
      return success(value)
    }
    return error(`Literal ${t.value} expected`, value)
  } else if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return success(value)
    }
    if (opts?.cast && value === null) {
      return success(undefined)
    }
    const result = decodeInternal(t.type, value, opts)
    if (!result.success) {
      return result.errors.length > 0 ? result : error(`Undefined expected`, value)
    }
    return result
  } else if (t.kind === 'nullable-decorator') {
    if (value === null) {
      return success(null)
    }
    if (opts?.cast && value === undefined) {
      return success(null)
    }
    const result = decodeInternal(t.type, value, opts)
    if (!result.success) {
      return result.errors.length > 0 ? result : error(`Null expected`, value)
    }
    return result
  } else if (t.kind === 'default-decorator') {
    const result = decodeInternal(t.type, value, opts)
    if (result.success) {
      return result
    }
    if (value === undefined || (opts?.cast && value === null)) {
      if (typeof t.opts.default === 'function') {
        return success(t.opts.default())
      }
      return success(t.opts.default)
    }
    return result
  } else if (t.kind === 'relation-decorator') {
    return decodeInternal(t.type, value, opts)
  } else if (t.kind === 'union-operator') {
    if (opts?.castGqlInputUnion) {
      //special graphql @oneOf
      const ts = Object.entries(t.types)
      if (typeof value === 'object' && value) {
        const keys = Object.keys(value)
        const key = keys[0]
        if (keys.length === 1 && ts.some((k) => k[0] === key)) {
          return decodeInternal(t.types[key], (value as Record<string, unknown>)[key], opts)
        }
      }
      return error(`Expect exactly one of this property ${ts.map((v) => `'${v[0]}'`).join(', ')}`, value)
    } else {
      const errs: { path?: string; error: string; value: unknown }[] = []
      for (const u of Object.values(t.types)) {
        const result = decodeInternal(u, value, opts)
        if (result.success) {
          return result
        }
        errs.push(...result.errors)
      }
      return errors(errs)
    }
  } else if (t.kind === 'object') {
    return concat2(assertObject(value, opts), (value) => decodeObjectProperties(value, t, opts))
  } else if (t.kind === 'array-decorator') {
    return concat2(assertArray(value, opts), (value) => decodeArrayElements(value, t, opts))
  } else if (t.kind === 'enum') {
    if (typeof value !== 'string' || !t.values.includes(value)) {
      return error(`Enumerator expected (${t.values.map((v) => `"${v}"`).join(' | ')})`, value)
    }
    return success(value)
  } else if (t.kind === 'custom') {
    const preDecoded = decodeInternal(t.encodedType, value, opts)
    if (!preDecoded.success) {
      return preDecoded
    }
    const result = t.decode(preDecoded.value, t.opts, opts)
    if (!result.success) {
      return result
    }
    return result
  }
  assertNever(t)
}

function assertString(value: unknown, opts: DecodeOptions | undefined): Result<string> {
  if (typeof value === 'string') {
    return success(value)
  }
  if (opts?.cast) {
    if (typeof value === 'number') {
      return success(value.toString())
    }
    if (typeof value === 'boolean') {
      return success(value ? 'true' : 'false')
    }
  }
  return error(`String expected`, value)
}

function assertObject(value: unknown, opts: DecodeOptions | undefined): Result<Record<string, unknown>> {
  if (typeof value !== 'object' || !value) {
    return error(`Object expected`, value)
  }
  return success(value as Record<string, unknown>)
}

function decodeObjectProperties(
  value: Record<string, unknown>,
  type: ObjectType,
  opts: DecodeOptions | undefined,
): Result<Record<string, unknown>> {
  const strict = opts?.strict ?? true
  const cast = opts?.cast
  if (!cast && strict) {
    const typeKeys = new Set(Object.keys(type.type))
    for (const key of Object.keys(value)) {
      if (!typeKeys.has(key)) {
        return enrichErrors(error(`Field is not expected`, value), key)
      }
    }
  }
  const accumulator: Record<string, unknown> = strict ? {} : { ...value }
  for (const [key, subtype] of Object.entries(type.type)) {
    const result = decodeInternal(subtype as LazyType, value[key], opts)
    const enrichedResult = enrichErrors(result, key)
    if (!enrichedResult.success) {
      return enrichedResult
    }
    if (enrichedResult.value !== undefined) {
      accumulator[key] = enrichedResult.value
    }
  }
  return success(accumulator)
}

function assertArray(value: unknown, opts: DecodeOptions | undefined): Result<unknown[]> {
  if (Array.isArray(value)) {
    return success(value)
  }
  if (opts?.cast && typeof value === 'object' && value) {
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

function decodeArrayElements(
  value: unknown[],
  type: ArrayDecorator,
  opts: DecodeOptions | undefined,
): Result<unknown[]> {
  const values: unknown[] = []
  for (let i = 0; i < value.length; i++) {
    const result = decodeInternal(type.type, value[i], opts)
    const enrichedResult = enrichErrors(result, i.toString())
    if (!enrichedResult.success) {
      return enrichedResult
    }
    values.push(enrichedResult.value)
  }
  return success(values)
}

function assertNumber(value: unknown, opts: DecodeOptions | undefined): Result<number> {
  if (typeof value === 'number') {
    return success(value)
  }
  if (opts?.cast) {
    const v = Number(value)
    if (!Number.isNaN(v)) {
      return success(v)
    }
  }
  return error(`Number expected`, value)
}

function assertBoolean(value: unknown, opts: DecodeOptions | undefined): Result<boolean> {
  if (typeof value === 'boolean') {
    return success(value)
  }
  if (opts?.cast) {
    if (typeof value === 'number') {
      return success(value ? true : false)
    }
    if (typeof value === 'string') {
      return success(value ? true : false)
    }
  }
  return error(`Boolean expected`, value)
}
