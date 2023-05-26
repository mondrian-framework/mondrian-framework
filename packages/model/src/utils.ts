import { assertNever } from '@mondrian-framework/utils'
import {
  ArrayDecorator,
  BooleanType,
  CustomType,
  EnumeratorType,
  LiteralType,
  NullableDecorator,
  NumberType,
  ObjectType,
  StringType,
  UnionOperator,
  array,
  nullable,
  object,
  optional,
  relation,
  union,
} from './type-system'
import { DefaultDecorator, LazyType, OptionalDecorator, RelationDecorator, Type } from './type-system'

export function lazyToType(t: LazyType): Type {
  if (typeof t === 'function') {
    return t()
  }
  return t
}

export function getFirstConcreteType(
  type: LazyType,
): NumberType | StringType | EnumeratorType | BooleanType | CustomType | LiteralType | ObjectType | UnionOperator {
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
/*
export function getPartialDeepType(type: LazyType): LazyType {
  function getPartialDeepTypeInternal(type: LazyType, isAlreadyOptional: boolean): LazyType {
    if (typeof type === 'function') {
      return () => lazyToType(getPartialDeepTypeInternal(lazyToType(type), isAlreadyOptional))
    }

    if (
      type.kind === 'boolean' ||
      type.kind === 'string' ||
      type.kind === 'number' ||
      type.kind === 'enumerator' ||
      type.kind === 'custom' ||
      type.kind === 'literal'
    ) {
      return isAlreadyOptional ? type : optional(type)
    }
    if (type.kind === 'array-decorator') {
      return array(getPartialDeepTypeInternal(type.type, false))
    }
    if (type.kind === 'optional-decorator') {
      return isAlreadyOptional
        ? getPartialDeepTypeInternal(type.type, true)
        : optional(getPartialDeepTypeInternal(type.type, true))
    }
    if (type.kind === 'nullable-decorator') {
      return nullable(getPartialDeepTypeInternal(type.type, isAlreadyOptional))
    }
    if (type.kind === 'default-decorator') {
      return getPartialDeepTypeInternal(type.type, isAlreadyOptional)
    }
    if (type.kind === 'relation-decorator') {
      return relation(getPartialDeepTypeInternal(type.type, isAlreadyOptional))
    }
    if (type.kind === 'union-operator') {
      return union(
        Object.fromEntries(
          Object.entries(type.types).map(([k, t]) => {
            return [k, getPartialDeepTypeInternal(t, isAlreadyOptional)]
          }),
        ),
      )
    }
    if (type.kind === 'object') {
      const t = object(
        Object.fromEntries(
          Object.entries(type.type).map(([k, t]) => {
            return [k, optional(getPartialDeepTypeInternal(t, true))]
          }),
        ),
      )
      return isAlreadyOptional ? t : optional(t)
    }
    assertNever(type)
  }
  return getPartialDeepTypeInternal(type, false)
}
*/
