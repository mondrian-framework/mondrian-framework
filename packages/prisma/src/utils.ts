import { types, projection } from '@mondrian-framework/model'
import { deepMerge, filterMapObject } from '@mondrian-framework/utils'

export function projectionToSelection<T extends Record<string, unknown>>(
  type: types.Type,
  projection: projection.Projection | undefined,
  overrides?: T,
): T | undefined {
  if (projection === true || projection === undefined) {
    return undefined
  }
  const select = projectionToSelectionInternal(type, projection)
  return (overrides ? deepMerge(select, overrides) : select) as T
}

function projectionToSelectionInternal<T extends Record<string, unknown>>(
  type: types.Type,
  projection: projection.Projection,
): T | undefined {
  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case types.Kind.Number:
    case types.Kind.String:
    case types.Kind.Boolean:
    case types.Kind.Enum:
    case types.Kind.Literal:
    case types.Kind.Custom:
      return undefined
    case types.Kind.Union:
      throw new Error('PrismaUtils does not support union types')
    case types.Kind.Object:
      return objectProjectionToSelection(concreteType, projection) as T
    case types.Kind.Array:
    case types.Kind.Optional:
    case types.Kind.Nullable:
      return projectionToSelectionInternal(concreteType.wrappedType, projection)
    default:
      return undefined
  }
}

function objectProjectionToSelection(object: types.ObjectType<any, types.Fields>, projection: projection.Projection) {
  console.log('projection for object', projection)
  return projection
    ? filterMapObject(object.fields, (_, fieldValue) => ('virtual' in fieldValue ? undefined : true))
    : filterMapObject(object.fields, (fieldName, fieldValue) => {
        const fieldType = types.unwrap(types.unwrapField(fieldValue))
        console.log('field:', fieldName)
        console.log('value:', fieldValue)
        const subProjection = projection[fieldName]
        return subProjection && fieldType.kind !== types.Kind.Union
          ? projectionToSelectionInternal(fieldType, subProjection)
          : undefined
      })
}
