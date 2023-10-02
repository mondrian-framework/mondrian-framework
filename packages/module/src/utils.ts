import { types } from '@mondrian-framework/model'
import { assertNever } from '@mondrian-framework/utils'
import crypto from 'crypto'

/**
 * Generates a random operation id.
 * It's a UUID v4.
 *
 * @returns new random operation id.
 */
export function randomOperationId() {
  return crypto.randomUUID()
}

export function uniqueTypes(from: types.Type): Set<types.Type> {
  return gatherUniqueTypes(new Set(), from)
}

export function allUniqueTypes(from: types.Type[]): Set<types.Type> {
  return from.reduce(gatherUniqueTypes, new Set())
}

function gatherUniqueTypes(inspectedTypes: Set<types.Type>, type: types.Type): Set<types.Type> {
  if (inspectedTypes.has(type)) {
    return inspectedTypes
  } else {
    inspectedTypes.add(type)
  }

  if (typeof type === 'function') {
    const concreteType = type()
    switch (concreteType.kind) {
      case types.Kind.Union:
        return gatherTypesReferencedByUnion(inspectedTypes, concreteType)
      case types.Kind.Object:
        return gatherTypesReferencedByObject(inspectedTypes, concreteType)
      default:
        assertNever(concreteType)
    }
  } else {
    switch (type.kind) {
      case types.Kind.Number:
      case types.Kind.String:
      case types.Kind.Boolean:
      case types.Kind.Enum:
      case types.Kind.Literal:
      case types.Kind.Custom:
        return inspectedTypes
      case types.Kind.Array:
      case types.Kind.Optional:
      case types.Kind.Nullable:
        return gatherUniqueTypes(inspectedTypes, type.wrappedType)
      case types.Kind.Union:
        return gatherTypesReferencedByUnion(inspectedTypes, type)
      case types.Kind.Object:
        return gatherTypesReferencedByObject(inspectedTypes, type)
      default:
        assertNever(type)
    }
  }
}

function gatherTypesReferencedByUnion(inspectedTypes: Set<types.Type>, type: types.UnionType<any>): Set<types.Type> {
  const variants = type.variants as Record<string, types.Type>
  return Object.values(variants).reduce(gatherUniqueTypes, inspectedTypes)
}

function gatherTypesReferencedByObject(
  inspectedTypes: Set<types.Type>,
  type: types.ObjectType<any, any>,
): Set<types.Type> {
  const fields = type.fields as Record<string, types.Field>
  return Object.values(fields).reduce(gatherTypesReferencedByField, inspectedTypes)
}

function gatherTypesReferencedByField(inspectedTypes: Set<types.Type>, field: types.Field): Set<types.Type> {
  return gatherUniqueTypes(inspectedTypes, types.unwrapField(field))
}
