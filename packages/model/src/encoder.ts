import { JSONType, assertNever } from '@mondrian/utils'
import { Infer, LazyType } from './type-system'
import { lazyToType } from './utils'

export function encode<const T extends LazyType>(type: T, value: Infer<T>): JSONType {
  return encodeInternal(type, value as JSONType)
}

function encodeInternal(type: LazyType, value: JSONType): JSONType {
  const t = lazyToType(type)
  if (t.kind === 'boolean' || t.kind === 'enumerator' || t.kind === 'number' || t.kind === 'string') {
    return value
  }
  if (t.kind === 'custom') {
    return t.encode(value, t.opts)
  }
  if (t.kind === 'literal') {
    return t.value
  }
  if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return undefined
    }
    return encode(t.type, value)
  }
  if (t.kind === 'default-decorator') {
    return encode(t.type, value)
  }
  if (t.kind === 'array-decorator') {
    const results = []
    for (const v of value as Array<JSONType>) {
      results.push(encodeInternal(t.type, v))
    }
    return results
  }
  if (t.kind === 'object') {
    const ret: { [K in string]: JSONType } = {}
    for (const [key, v] of Object.entries(value as object)) {
      const subtype = t.type[key]
      if (subtype) {
        ret[key] = encode(subtype, v)
      }
    }
    return ret
  }
  if (t.kind === 'union-operator') {
    for (const subtype of Object.values(t.types)) {
      if (is(subtype, value)) {
        return encode(subtype, value)
      }
    }
    throw new Error('Invalid value for this union.')
  }

  assertNever(t)
}

function is(type: LazyType, value: JSONType): boolean {
  const t = lazyToType(type)
  if (t.kind === 'boolean') {
    return typeof value === 'boolean'
  }
  if (t.kind === 'number') {
    return typeof value === 'number'
  }
  if (t.kind === 'string') {
    return typeof value === 'string'
  }
  if (t.kind === 'enumerator') {
    if (typeof value !== 'string') {
      return false
    }
    return t.values.includes(value)
  }
  if (t.kind === 'custom') {
    return t.is(value, t.opts)
  }
  if (t.kind === 'literal') {
    return t.value === value
  }
  if (t.kind === 'optional-decorator') {
    if (value === undefined) {
      return true
    }
    return is(t.type, value)
  }
  if (t.kind === 'default-decorator') {
    return is(t.type, value)
  }
  if (t.kind === 'array-decorator') {
    for (const v of value as Array<JSONType>) {
      if (!is(t.type, v)) {
        return false
      }
    }
    return true
  }
  if (t.kind === 'object') {
    for (const [key, v] of Object.entries(value as object)) {
      const subtype = t.type[key]
      if (subtype && !is(subtype, v)) {
        return false
      }
    }
    return true
  }
  if (t.kind === 'union-operator') {
    for (const subtype of Object.values(t.types)) {
      if (is(subtype, value)) {
        return true
      }
    }
    return false
  }
  assertNever(t)
}
