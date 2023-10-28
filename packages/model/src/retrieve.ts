import { decoding, result, types, validation } from '.'
import { memoizeTypeTransformation } from './utils'
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
export type GenericWhere = { AND?: GenericWhere | GenericWhere[] } & Record<string, { equals?: unknown }>
export type GenericSelect = null | Record<string, undefined | GenericRetrieve | boolean>
export type GenericOrderBy = {} | {}[]

// prettier-ignore
export type FromType<T extends types.Type, C extends Capabilities>
  = [T] extends [types.EntityType<any, any>] ? WhereType<T, C> & SelectType<T, C> & OrderByType<T, C> & TakeType<C> & SkipType<C>
  : [T] extends [types.ArrayType<any, infer T1>] ? FromType<T1, C>
  : [T] extends [types.OptionalType<infer T1>] ? FromType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? FromType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? FromType<T1, C>
  : never

type TakeType<C extends Capabilities> = [C] extends [{ take: true }] ? { take?: number } : {}
type SkipType<C extends Capabilities> = [C] extends [{ skip: true }] ? { skip?: number } : {}

type AllCapabilities = {
  where: true
  select: true
  orderBy: true
  take: true
  skip: true
}

// prettier-ignore
type SelectType<T extends types.Type, C extends Capabilities>
  = [C] extends [{ select: true }]
  ? [T] extends [types.EntityType<any, infer Ts>] ? { select?: { [K in keyof Ts]?: boolean | SelectType<Ts[K], { select: true }> } } & WhereType<T, C>
  : [T] extends [types.ObjectType<any, infer Ts>] ? { select?: { [K in keyof Ts]?: boolean | SelectType<Ts[K], { select: true }> } }
  : [T] extends [types.ArrayType<any, infer T1>] ? SelectType<T1, AllCapabilities>
  : [T] extends [types.OptionalType<infer T1>] ? SelectType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? SelectType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? SelectType<T1, C>
  : never : {}

// prettier-ignore
type OrderByType<T extends types.Type, C extends Capabilities>
  = [C] extends [{ orderBy: true }]
  ? [T] extends [types.EntityType<any, infer Ts>] ? { orderBy?: OrderByFields<Ts> | OrderByFields<Ts>[] } 
  : [T] extends [types.ArrayType<any, infer T1>] ? SelectType<T1, AllCapabilities>
  : [T] extends [types.OptionalType<infer T1>] ? SelectType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? SelectType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? SelectType<T1, C>
  : never : {}

type SortDirection = 'asc' | 'desc'
type OrderByFields<Ts extends types.Types> = { [K in keyof Ts]?: OrderByField<Ts[K]> }
// prettier-ignore
type OrderByField<T extends types.Type> 
  = [T] extends [types.EntityType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [types.ObjectType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [types.ArrayType<any, any>] ? { _count?: SortDirection }
  : [T] extends [types.OptionalType<infer T1>] ? OrderByField<T1>
  : [T] extends [types.NullableType<infer T1>] ? OrderByField<T1>
  : [T] extends [(() => infer T1 extends types.Type)] ? OrderByField<T1>
  : SortDirection

// prettier-ignore
type WhereType<T extends types.Type, C extends Capabilities> 
  = [C] extends [{ where: true }]
  ? [T] extends [types.EntityType<any, infer Ts>] ? { where?: WhereFields<Ts> }
  : [T] extends [types.ArrayType<any, infer T1>] ? WhereType<T1, AllCapabilities>
  : [T] extends [types.OptionalType<infer T1>] ? WhereType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? WhereType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? WhereType<T1, C>
  : never : {}

type WhereFields<Ts extends types.Types> = { [K in WhereFieldKeys<Ts>]?: WhereField<Ts[K]> } & {
  AND?: WhereFields<Ts>[]
  OR?: WhereFields<Ts>[]
  NOT?: WhereFields<Ts>
}
// prettier-ignore
type WhereField<T extends types.Type> 
  = [T] extends [types.EntityType<any, infer Ts>] ? WhereFields<Ts>
  : [T] extends [types.ArrayType<any, infer T1>] ? undefined //TODO
  : [T] extends [types.StringType] ? { equals?: string } //TODO other types
  : [T] extends [(() => infer T1 extends types.Type)] ? WhereField<T1>
  : undefined

type WhereFieldKeys<Ts extends types.Types> = {
  [K in keyof Ts]: WhereField<Ts[K]> extends Record<string, unknown> ? K : never
}[keyof Ts]

export type MergeOptions = {
  orderByOrder?: 'left-before' | 'right-before'
  skipOrder?: 'left-before' | 'right-before'
  takeOrder?: 'left-before' | 'right-before'
}
export function merge<const T extends GenericRetrieve>(
  type: types.Type,
  left?: T,
  right?: T,
  options?: MergeOptions,
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
  options?: MergeOptions,
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
            return true
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
          return { select: deepMerge(rightSelect.select, leftSelect.select) as GenericSelect }
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

export function selectedType(type: types.Type, select: GenericSelect): types.Type {
  if (!select) {
    return type
  }
  return types.match(type, {
    optional: ({ wrappedType }) => types.optional(selectedType(wrappedType, select)),
    nullable: ({ wrappedType }) => types.nullable(selectedType(wrappedType, select)),
    array: ({ wrappedType }) => types.optional(selectedType(wrappedType, select)),
    record: ({ fields }, t) => {
      const selectedFields = flatMapObject(fields, (fieldName, fieldType) => {
        const selection = select[fieldName]
        if (selection === true) {
          return [[fieldName, fieldType]]
        } else if (typeof selection === 'object' && selection.select) {
          return [[fieldName, selectedType(fieldType, selection.select)]]
        } else {
          return []
        }
      })
      return types.object(selectedFields)
    },
    otherwise: (t) => t,
  })
}

export function isRespected<T extends types.Type>(
  type: T,
  retrieve: FromType<T, { select: true }>,
  value: types.Infer<T>,
): result.Result<{ trimmedValue: types.Infer<T> }, decoding.Error[] | validation.Error[]> {
  const typeToRespect = retrieve.select ? selectedType(type, retrieve.select) : type
  const result = types.concretise(typeToRespect).decode(value)
  return result.map((trimmedValue) => ({ trimmedValue }))
}

export function fromType(type: types.Type, capabilities: Capabilities | undefined): result.Result<types.Type, null> {
  if (!capabilities) {
    return result.fail(null)
  }
  const res = types.match(type, {
    wrapper: ({ wrappedType }) => fromType(wrappedType, capabilities),
    entity: (type) => result.ok(retrieve(type, capabilities)),
    otherwise: () => result.fail(null),
  }) as result.Result<types.Type, null>
  return res
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

function select(type: types.Type): types.Type {
  return types.match(type, {
    wrapper: ({ wrappedType }) => select(wrappedType),
    array: ({ wrappedType }) => {
      const matcher: (type: types.Type) => types.Type = types.matcher({
        wrapper: (t) => matcher(t),
        array: () => {
          throw new Error('Array of array not supported in selection')
        },
        entity: (_, entity) =>
          types.union({
            retrieve: retrieve(entity, { orderBy: true, select: true, skip: true, take: true, where: true }),
            all: types.boolean(),
          }),
        otherwise: (_, type) => select(type),
      })
      return matcher(wrappedType)
    },
    entity: (_, entity) =>
      types.union({
        retrieve: retrieve(entity, { select: true }),
        all: types.boolean(),
      }),
    object: (
      { fields }, // { select?: { ... } } | boolean
    ) =>
      types.union({
        fields: types
          .object({ select: types.object(mapObject(fields, (_, fieldType) => types.optional(select(fieldType)))) })
          .optional(),
        all: types.boolean(),
      }),
    otherwise: () => types.boolean(),
  })
}

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

function where(type: types.Type): types.Type {
  return types.match(type, {
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
}

const entityOrderBy = memoizeTypeTransformation<types.Lazy<types.EntityType<types.Mutability, types.Types>>>((type) => {
  const entity = types.concretise(type)
  return types.object(
    mapObject(entity.fields, (_, fieldType) => types.optional(orderBy(fieldType))),
    { name: `${entity.options?.name ?? randomUUID()}OrderBy` },
  )
})

function sortDirection() {
  return types.union({ asc: types.literal('asc'), desc: types.literal('desc') }, { name: 'SortDirection' })
}
function orderBy(type: types.Type): types.Type {
  return types.match(type, {
    wrapper: ({ wrappedType }) => orderBy(wrappedType),
    array: () => types.object({ _count: types.optional(sortDirection) }),
    entity: (_, entity) => entityOrderBy(entity),
    object: ({ fields }) => types.object(mapObject(fields, (_, fieldType) => types.optional(orderBy(fieldType)))),
    otherwise: (t) => sortDirection,
  })
}
