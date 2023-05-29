import {
  ArrayDecorator,
  BooleanType,
  EnumeratorType,
  AnyLazyType,
  LiteralType,
  NullableDecorator,
  NumberType,
  ObjectType,
  RootCustomType,
  StringType,
  AnyType,
  UnionOperator,
} from './type-system'
import { DefaultDecorator, LazyType, OptionalDecorator, RelationDecorator, Type } from './type-system'

export function lazyToType(t: LazyType): AnyType {
  if (typeof t === 'function') {
    return t() as AnyType
  }
  return t as AnyType
}

export function getFirstConcreteType(
  type: LazyType,
): NumberType | StringType | EnumeratorType | BooleanType | RootCustomType | LiteralType | ObjectType | UnionOperator {
  const t = lazyToType(type)
  if (
    t.kind === 'default-decorator' ||
    t.kind === 'array-decorator' ||
    t.kind === 'nullable-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'relation-decorator'
  ) {
    return getFirstConcreteType(t.type)
  }
  return t
}

export function isVoidType(type: LazyType): boolean {
  const t = getFirstConcreteType(type)
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
