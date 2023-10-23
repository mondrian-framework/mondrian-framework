import { result, types } from '.'
import {
  failWithInternalError,
  memoizeTypeTransformation,
  memoizeTransformation,
  memoizeTypeTransformationWithParam,
} from './utils'
import { deepMerge, flatMapObject, mapObject } from '@mondrian-framework/utils'
import { randomUUID } from 'crypto'

export type Capabilities = {
  where?: true
  select?: true
  orderBy?: true
  take?: true
  skip?: true
}

export type GenericRetrieve = {
  where?: GenericWhere
  select?: GenericSelect
  orderBy?: GenericOrderBy
  take?: number
  skip?: number
}
export type GenericWhere = { AND?: GenericWhere | GenericWhere[] }
export type GenericSelect = null | Record<string, undefined | GenericRetrieve | GenericFieldSelect>
type GenericFieldSelect = boolean | { [K in string]: GenericFieldSelect }
export type GenericOrderBy = {} | {}[]

// prettier-ignore
export type FromType<T extends types.Type, C extends Capabilities | undefined> = GenericRetrieve /* TODO
  = [T] extends [types.EntityType<types.Mutability, infer Ts>] ? { where?: Where<Ts> } 
  : [T] extends [types.ArrayType<types.Mutability, infer T1>] ? FromType<T1>
  : [T] extends [(() => infer T1 extends types.Type)] ? FromType<T1>
  : GenericRetrieve
  */

type Where<Ts extends types.Types> = { [K in WhereFieldKeys<Ts>]?: WhereField<Ts[K]> } & {
  AND?: Where<Ts> | Where<Ts>[]
  OR?: Where<Ts> | Where<Ts>[]
  NOT?: Where<Ts>
}

// prettier-ignore
type WhereField<T extends types.Type> 
  = [T] extends [types.EntityType<types.Mutability, infer Ts>] ? Where<Ts>
  : [T] extends [types.ArrayType<types.Mutability, infer T1>] ? undefined //TODO
  : [T] extends [types.StringType] ? { equals?: string }
  : [T] extends [(() => infer T1 extends types.Type)] ? WhereField<T1>
  : undefined

type WhereFieldKeys<Ts extends types.Types> = {
  [K in keyof Ts]: WhereField<Ts[K]> extends Record<string, unknown> ? K : never
}[keyof Ts]

type RetrieveOptions = {
  maxTake?: number
}

export function merge<const T extends GenericRetrieve>(
  type: types.Type,
  left?: T,
  right?: T,
  options?: {
    orderByOrder?: 'left-before' | 'right-before'
    skipOrder?: 'left-before' | 'right-before'
    takeOrder?: 'left-before' | 'right-before'
  },
): T | undefined {
  if (!left || !right) {
    return left || right
  }
  const rightOrderBy = right.orderBy ? (Array.isArray(right.orderBy) ? right.orderBy : [right.orderBy]) : []
  const leftOrderBy = left.orderBy ? (Array.isArray(left.orderBy) ? left.orderBy : [left.orderBy]) : []
  const orderBy =
    options?.orderByOrder === 'right-before' ? [...rightOrderBy, ...leftOrderBy] : [...leftOrderBy, ...rightOrderBy]
  return {
    where: left.where && right.where ? { AND: [left.where, right.where] } : left.where ?? right.where,
    orderBy: orderBy.length === 0 ? undefined : orderBy,
    skip: options?.skipOrder === 'right-before' ? right.skip ?? left.skip : left.skip ?? right.skip,
    take: options?.takeOrder === 'right-before' ? right.take ?? left.take : left.take ?? right.take,
    select: mergeSelect(type, left.select, right.select, options),
  } as unknown as T
}

function mergeSelect(
  type: types.Type,
  left?: GenericSelect,
  right?: GenericSelect,
  options?: {
    orderByOrder?: 'left-before' | 'right-before'
    skipOrder?: 'left-before' | 'right-before'
    takeOrder?: 'left-before' | 'right-before'
  },
): GenericSelect | undefined {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return types.match(type, {
    entity: ({ fields }) => {
      return mapObject(fields, (fieldName, fieldType) => {
        const leftSelect = left[fieldName]
        const rightSelect = right[fieldName]
        if (!leftSelect) {
          return rightSelect
        }
        if (!rightSelect) {
          return leftSelect
        }
        const unwrappedFieldType = types.unwrap(fieldType)
        if (unwrappedFieldType.kind === types.Kind.Entity) {
          if (leftSelect === true && rightSelect === true) {
            return true //TODO: merge with the other
          }
          if (leftSelect === true && rightSelect !== true) {
            return merge(
              unwrappedFieldType,
              { select: mapObject(unwrappedFieldType.fields, () => true) },
              rightSelect,
              options,
            )
          }
          if (rightSelect === true && leftSelect !== true) {
            return merge(
              unwrappedFieldType,
              leftSelect,
              { select: mapObject(unwrappedFieldType.fields, () => true) },
              options,
            )
          }
          return merge(unwrappedFieldType, leftSelect as GenericRetrieve, rightSelect as GenericRetrieve, options)
        } else {
          if (leftSelect === true) {
            return true
          }
          if (rightSelect === true) {
            return true
          }
          return deepMerge(rightSelect, leftSelect) as GenericFieldSelect
        }
      })
    },
    wrapper: ({ wrappedType }) => mergeSelect(wrappedType, left, right, options),
    otherwise: () => left ?? right,
  })
}

export function selectionDepth(type: types.Type, retrieve: GenericRetrieve): number {
  return types.match(type, {
    wrapper: ({ wrappedType }) => selectionDepth(wrappedType, retrieve),
    entity: ({ fields }) =>
      Object.entries(fields)
        .map(([fieldName, fieldType]) => {
          if (!retrieve.select) {
            return 1
          }
          const unwrappedFieldType = types.unwrap(fieldType)
          if (unwrappedFieldType.kind === types.Kind.Entity && typeof retrieve.select[fieldName] === 'object') {
            return selectionDepth(fieldType, retrieve.select[fieldName] as GenericRetrieve) + 1
          } else {
            return 1
          }
        })
        .reduce((p, c) => Math.max(p, c), 0),
    otherwise: () => 1,
  })
}

export function isRespected<T extends types.Type>(
  type: T,
  retrieve: FromType<T, {}>,
  value: types.Infer<T>,
): result.Result<{ trimmedValue: types.Infer<T> }, any> {
  return result.ok({ trimmedValue: value }) //TODO
}

export function fromType(type: types.Type, capabilities: Capabilities | undefined): result.Result<types.Type, null> {
  if (!capabilities) {
    return result.fail(null)
  }
  const t = retrieve(types.unwrap(type), capabilities)
  if (types.isNever(t)) {
    return result.fail(null)
  } else {
    return result.ok(t)
  }
}

function retrieve(type: types.Type, capabilities: Capabilities): types.Type {
  return types.match(type, {
    entity: (_, entity) => {
      return types.object({
        ...(capabilities.where ? { where: types.optional(entityWhere(entity)) } : {}),
        ...(capabilities.select ? { select: types.optional(entitySelect(entity)) } : {}),
        ...(capabilities.orderBy ? { orderBy: types.optional(types.array(entityOrderBy(entity))) } : {}),
        ...(capabilities.skip ? { skip: types.integer({ minimum: 0 }).optional() } : {}),
        ...(capabilities.take ? { take: types.integer({ minimum: 0, maximum: 20 }).optional() } : {}),
        //distinct: types.unknown(), //TODO: need untagged union
      })
    },
    otherwise: () => types.never(),
  })
}

const entitySelect = memoizeTypeTransformation<types.Lazy<types.EntityType<types.Mutability, types.Types>>>((type) => {
  const entity = types.concretise(type)
  return types.object(
    mapObject(entity.fields, (_, fieldType) => types.optional(select(fieldType))),
    { name: `${entity.options?.name ?? randomUUID()}Select` },
  )
})

const select: (type: types.Type) => types.Type = types.matcher({
  wrapper: ({ wrappedType }) => select(wrappedType),
  array: ({ wrappedType }) => {
    const matcher: (type: types.Type) => types.Type = types.matcher({
      wrapper: (t) => matcher(t),
      array: () => {
        throw new Error('Array of array not supported in selection')
      },
      entity: (_, entity) => retrieve(entity, { orderBy: true, select: true, skip: true, take: true, where: true }),
      otherwise: (_, type) => select(type),
    })
    return matcher(wrappedType)
  },
  entity: (_, entity) => retrieve(entity, { select: true }), //TODO: or true
  object: ({ fields }) => types.object(mapObject(fields, (_, fieldType) => types.optional(select(fieldType)))), // TODO: or true
  otherwise: () => types.boolean(),
})

const entityWhere = memoizeTypeTransformation<types.Lazy<types.EntityType<types.Mutability, types.Types>>>((type) => {
  const entity = types.concretise(type)
  return types.object(
    flatMapObject(entity.fields, (fieldName, fieldType) => {
      const result = types.optional(where(fieldType))
      return result ? [[fieldName, result]] : []
    }),
    { name: `${entity.options?.name ?? randomUUID()}Where` },
  )
})

const where: (type: types.Type) => types.Type = types.matcher({
  wrapper: (t) => where(t),
  array: ({ wrappedType }) => {
    const matcher: (type: types.Type) => types.Type = types.matcher({
      wrapper: (t) => matcher(t),
      scalar: (t) => types.object({ equals: types.optional(types.array(t)) }),
      array: () => {
        throw new Error('Array of array not supported in where')
      },
      entity: (_, entity) => {
        const fieldWhereType = entityWhere(entity)
        return types.object({
          some: types.optional(fieldWhereType),
          every: types.optional(fieldWhereType),
          none: types.optional(fieldWhereType),
        })
      },
      otherwise: () => {
        throw 'TODO'
      },
    })
    return matcher(wrappedType)
  },
  object: () => types.object({}), //TODO
  union: () => types.object({}), //TODO
  entity: (_, entity) => entityWhere(entity),
  scalar: (t) => types.object({ equals: types.optional(t) }),
})

const entityOrderBy = memoizeTypeTransformation<types.Lazy<types.EntityType<types.Mutability, types.Types>>>((type) => {
  const entity = types.concretise(type)
  return types.object(
    mapObject(entity.fields, (_, fieldType) => types.optional(orderBy(fieldType))),
    { name: `${entity.options?.name ?? randomUUID()}OrderBy` },
  )
})

const sortDirection = types.union(
  { asc: types.literal('asc'), desc: types.literal('desc') },
  { name: 'SortDirection', useTags: false },
)
const orderBy: (type: types.Type) => types.Type = types.matcher({
  wrapper: ({ wrappedType }) => orderBy(wrappedType),
  array: () => types.object({ _count: types.optional(sortDirection) }),
  entity: (_, entity) => entityOrderBy(entity),
  object: ({ fields }) => types.object(mapObject(fields, (_, fieldType) => types.optional(orderBy(fieldType)))),
  otherwise: (t) => sortDirection,
})
