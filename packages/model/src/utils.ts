import { ArrayDecorator, NullableDecorator } from './type-system'
import { DefaultDecorator, LazyType, OptionalDecorator, RelationDecorator, Type } from './type-system'

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

export function isNullable(type: LazyType): boolean {
  return hasDecorator(type, 'nullable-decorator')
}

export function hasDecorator(
  type: LazyType,
  decorator:
    | OptionalDecorator['kind']
    | RelationDecorator['kind']
    | DefaultDecorator['kind']
    | ArrayDecorator['kind']
    | NullableDecorator['kind'],
): boolean {
  const t = lazyToType(type)
  if (t.kind === decorator) {
    return true
  }
  if (
    t.kind === 'default-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'relation-decorator' ||
    t.kind === 'nullable-decorator'
  ) {
    return hasDecorator(t.type, decorator)
  }
  return false
}
