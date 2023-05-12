import { LazyType, Type } from './type-system'

export function lazyToType(t: LazyType): Type {
  if (typeof t === 'function') {
    return t()
  }
  return t
}

export function isVoidType(type: LazyType): boolean {
  const t = lazyToType(type)
  return t.kind === 'custom' && t.name === 'void'
}

export function isNullType(type: LazyType): boolean {
  const t = lazyToType(type)
  return t.kind === 'literal' && t.value === null
}
