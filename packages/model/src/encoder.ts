import { JSONType, assertNever } from '@mondrian/utils'
import { Infer, LazyType } from './type-system'
import { lazyToType } from './utils'
import { is } from './is'

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
      return null
    }
    return encode(t.type, value)
  }
  if (t.kind === 'default-decorator' || t.kind === 'reference-decorator') {
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
