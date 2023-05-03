import { decode } from './decoder'
import { Infer, LazyType } from './type-system'
import { JSONType, assertNever, lazyToType } from './utils'

export function encode<const T extends LazyType>(type: T, value: Infer<T>): JSONType {
  return encodeInternal(type, value as JSONType)
}
function encodeInternal(type: LazyType, value: JSONType): JSONType {
  const t = lazyToType(type)
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
  if (t.kind === 'custom') {
    return t.encode(value, t.opts)
  }
  if (t.kind === 'union-operator') {
    for (const subtype of Object.values(t.types)) {
      if (decode(subtype, value).pass) {
        return encode(subtype, value)
      }
    }
    assertNever(t as never)
  }
  if (t.kind === 'name-decorator') {
    return encode(t.type, value)
  }
  if (
    t.kind === 'boolean' ||
    t.kind === 'enumerator' ||
    t.kind === 'null' ||
    t.kind === 'number' ||
    t.kind === 'string'
  ) {
    return value
  }
  assertNever(t)
}
