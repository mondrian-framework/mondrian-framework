import { JSONType, assertNever } from '@mondrian/utils'
import { LazyType } from './type-system'
import { lazyToType } from './utils'

export function is(type: LazyType, value: JSONType): boolean {
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
  if (t.kind === 'nullable-decorator') {
    if (value === null) {
      return true
    }
    return is(t.type, value)
  }
  if (t.kind === 'default-decorator' || t.kind === 'relation-decorator') {
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
