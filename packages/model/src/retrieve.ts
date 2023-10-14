import { types } from '.'
import { flatMapObject, mapObject } from '@mondrian-framework/utils'

export type Retrieve<T extends types.Type> = any

type RetrieveOptions = {
  maxTake?: number
}

export function fromEntity(
  entity: types.EntityType<types.Mutability, types.Types>,
  options?: RetrieveOptions,
): types.Type {
  return types.object({
    where: where(entity),
    select: types.object({}),
    orderBy: types.array(types.object({})),
    //distinct: types.unknown(),
    skip: types.integer({ minimum: 0 }),
    take: types.integer({ minimum: 0, maximum: options?.maxTake }),
  })
}

function where(entity: types.EntityType<types.Mutability, types.Types>): types.Type {
  const fields = flatMapObject(entity.fields, (fieldName, fieldType) => {
    if (types.isScalar(fieldType)) {
      const nakedFieldType = types.unwrap(fieldType)
      if (types.isArray(fieldType)) {
        return [
          [fieldName, types.object({ equals: types.optional(types.array(nakedFieldType)) })] as [string, types.Type],
        ]
      } else {
        return [[fieldName, types.object({ equals: types.optional(nakedFieldType) })]]
      }
    }
    const concreteFieldType = types.concretise(fieldType)
    if (concreteFieldType.kind === types.Kind.Entity) {
      const fieldWhereType = where(concreteFieldType)
      if (types.isArray(concreteFieldType)) {
        return [
          [
            fieldName,
            types.object({
              some: types.optional(fieldWhereType),
              every: types.optional(fieldWhereType),
              none: types.optional(fieldWhereType),
            }),
          ],
        ]
      } else {
        return [[fieldName, fieldWhereType]]
      }
    }
    //TODO: embedded (object)
    return []
  })
  return types.object(fields)
}
