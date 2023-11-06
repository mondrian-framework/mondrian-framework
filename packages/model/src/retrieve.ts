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
export type GenericWhere = { readonly AND?: GenericWhere | readonly GenericWhere[] } & { readonly [K in string]: any }
export type GenericSelect = null | { readonly [K in string]: undefined | GenericRetrieve | boolean }
export type GenericOrderBy = {} | {}[]

// prettier-ignore
export type FromType<T extends types.Type, C extends Capabilities | undefined>
  = [types.Type] extends [T] ? GenericRetrieve 
  : [C] extends [Capabilities]
  ? [T] extends [types.EntityType<any, any>] ? WhereType<T, C> & SelectType<T, C> & OrderByType<T, C> & TakeType<C> & SkipType<C>
  : [T] extends [types.ArrayType<any, infer T1>] ? FromType<T1, C>
  : [T] extends [types.OptionalType<infer T1>] ? FromType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? FromType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? FromType<T1, C>
  : never : never

type TakeType<C extends Capabilities> = [C] extends [{ readonly take: true }] ? { readonly take?: number } : {}
type SkipType<C extends Capabilities> = [C] extends [{ readonly skip: true }] ? { readonly skip?: number } : {}

export type AllCapabilities = typeof allCapabilities
export const allCapabilities = { orderBy: true, select: true, skip: true, take: true, where: true } as const

// prettier-ignore
type SelectType<T extends types.Type, C extends Capabilities>
  = [C] extends [{ readonly select: true }]
  ? [T] extends [types.EntityType<any, infer Ts>] ? { readonly select?: { readonly [K in keyof Ts]?: boolean | SelectType<Ts[K], { select: true }> } } & WhereType<T, C>
  : [T] extends [types.ObjectType<any, infer Ts>] ? { readonly select?: { readonly [K in keyof Ts]?: boolean | SelectType<Ts[K], { select: true }> } }
  : [T] extends [types.ArrayType<any, infer T1>] ? SelectType<T1, AllCapabilities>
  : [T] extends [types.OptionalType<infer T1>] ? SelectType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? SelectType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? SelectType<T1, C>
  : never : {}

// prettier-ignore
type OrderByType<T extends types.Type, C extends Capabilities>
  = [C] extends [{ readonly orderBy: true }]
  ? [T] extends [types.EntityType<any, infer Ts>] ? { readonly orderBy?: OrderByFields<Ts>[] } 
  : [T] extends [types.ArrayType<any, infer T1>] ? SelectType<T1, AllCapabilities>
  : [T] extends [types.OptionalType<infer T1>] ? SelectType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? SelectType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? SelectType<T1, C>
  : never : {}

type OrderByFields<Ts extends types.Types> = { readonly [K in keyof Ts]?: OrderByField<Ts[K]> }
// prettier-ignore
type OrderByField<T extends types.Type> 
  = [T] extends [types.EntityType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [types.ObjectType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [types.ArrayType<any, any>] ? { readonly _count?: SortDirection }
  : [T] extends [types.OptionalType<infer T1>] ? OrderByField<T1>
  : [T] extends [types.NullableType<infer T1>] ? OrderByField<T1>
  : [T] extends [(() => infer T1 extends types.Type)] ? OrderByField<T1>
  : SortDirection

// prettier-ignore
type WhereType<T extends types.Type, C extends Capabilities> 
  = [C] extends [{ readonly where: true }]
  ? [T] extends [types.EntityType<any, infer Ts>] ? { readonly where?: WhereFields<Ts> }
  : [T] extends [types.ArrayType<any, infer T1>] ? WhereType<T1, AllCapabilities>
  : [T] extends [types.OptionalType<infer T1>] ? WhereType<T1, C>
  : [T] extends [types.NullableType<infer T1>] ? WhereType<T1, C>
  : [T] extends [(() => infer T1 extends types.Type)] ? WhereType<T1, C>
  : never : {}

type WhereFields<Ts extends types.Types> = { readonly [K in keyof Ts]?: WhereField<Ts[K]> } & {
  readonly AND?: WhereFields<Ts>[]
  readonly OR?: WhereFields<Ts>[]
  readonly NOT?: WhereFields<Ts>
}
// prettier-ignore
type WhereField<T extends types.Type> 
  = [T] extends [types.EntityType<any, infer Ts>] ? WhereFields<Ts>
  : [T] extends [types.ArrayType<any, infer T1>] ? WhereFieldArray<T1>
  : [T] extends [types.StringType] ? { readonly equals?: string }
  : [T] extends [types.ObjectType<any, any>] ? { readonly equals?: types.Infer<T> }
  : [T] extends [types.EntityType<any, infer Ts>] ? WhereFields<Ts>
  : [T] extends [types.OptionalType<infer T1>] ? WhereField<T1>
  : [T] extends [types.NullableType<infer T1>] ? WhereField<T1>
  : [T] extends [(() => infer T1 extends types.Type)] ? WhereField<T1>
  : undefined

// prettier-ignore
type WhereFieldArray<T extends types.Type> 
  = [T] extends [types.EntityType<any, infer Ts>] ? { readonly some?: WhereFields<Ts>; readonly every?: WhereFields<Ts>, readonly none?: WhereFields<Ts> }
  : [T] extends [types.OptionalType<infer T1>] ? WhereFieldArray<T1>
  : [T] extends [types.NullableType<infer T1>] ? WhereFieldArray<T1>
  : [T] extends [types.StringType] ? { readonly equals?: readonly string[], readonly isEmpty?: boolean }
  : [T] extends [types.ObjectType<any, any>] ? { readonly equals?: readonly types.Infer<T>[], readonly isEmpty?: boolean }
  : [T] extends [(() => infer T1 extends types.Type)] ? WhereFieldArray<T1>
  : undefined

/**
 * Gets the depth of the selection.
 * @param type {@link types.Type Type} to follow in order to cimpute the depth.
 * @param retrieve retrieve instance with the selection
 * @returns the selection depth
 */
export function selectionDepth<T extends types.Type>(type: T, retrieve: FromType<T, { select: true }>): number {
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
          } else if (unwrappedFieldType.kind === types.Kind.Entity && retrieve.select[fieldName] === true) {
            return 2
          } else {
            return 1
          }
        })
        .reduce((p, c) => Math.max(p, c), 0),
    otherwise: () => 1,
  })
}

function removeEmbeddedEntities(type: types.Type): types.Type {
  function omitEntityFields(fields: types.Types): types.Types {
    return flatMapObject(fields, (fieldName, fieldType) =>
      types.unwrap(fieldType).kind === types.Kind.Entity ? [] : [[fieldName, fieldType]],
    )
  }
  return types.match(type, {
    optional: ({ wrappedType }) => types.optional(removeEmbeddedEntities(wrappedType)),
    nullable: ({ wrappedType }) => types.nullable(removeEmbeddedEntities(wrappedType)),
    array: ({ wrappedType }) => types.array(removeEmbeddedEntities(wrappedType)),
    entity: ({ fields }) => types.entity(omitEntityFields(fields)),
    object: ({ fields }) => types.object(omitEntityFields(fields)),
    union: ({ variants }) => types.union(mapObject(variants, (_, variantType) => removeEmbeddedEntities(variantType))),
    otherwise: (_, t) => t,
  })
}
/**
 * Gets a projected {@link types.Type Type} in function of the given type and the retrieve selection.
 * @param type the root type.
 * @param retrieve the retrieve with a selection.
 * @returns the specific sub-type of the root type.
 */
export function selectedType<T extends types.Type>(
  type: T,
  retrieve: FromType<T, { select: true }> | undefined,
): types.Type {
  const select = retrieve?.select
  if (!select) {
    return removeEmbeddedEntities(type)
  }
  return types.match(type, {
    optional: ({ wrappedType }) => types.optional(selectedType(wrappedType, retrieve)),
    nullable: ({ wrappedType }) => types.nullable(selectedType(wrappedType, retrieve)),
    array: ({ wrappedType }) => types.array(selectedType(wrappedType, retrieve)),
    record: ({ fields }) => {
      const selectedFields = flatMapObject(fields, (fieldName, fieldType) => {
        const selection = select[fieldName]
        if (selection === true) {
          return [[fieldName, removeEmbeddedEntities(fieldType)]]
        } else if (typeof selection === 'object' && selection.select) {
          return [[fieldName, selectedType(fieldType, selection)]]
        } else {
          return [[fieldName, types.optional(fieldType)]]
        }
      })
      return types.object(selectedFields)
    },
    otherwise: (t) => t,
  })
}

export function fromType(
  type: types.Type,
  capabilities: Capabilities | undefined,
): result.Result<types.ObjectType<types.Mutability.Immutable, types.Types>, null> {
  if (!capabilities || Object.keys(capabilities).length === 0) {
    return result.fail(null)
  }
  const res = types.match(type, {
    wrapper: ({ wrappedType }) => fromType(wrappedType, capabilities),
    entity: (_, type) => result.ok(retrieve(type, capabilities)),
    otherwise: () => result.fail(null),
  }) as result.Result<types.Type, null>
  return res as result.Result<types.ObjectType<types.Mutability.Immutable, types.Types>, null>
}

function retrieve(
  entity: types.Lazy<types.EntityType<any, any>>,
  capabilities: Capabilities,
): types.ObjectType<types.Mutability.Immutable, types.Types> {
  return types.object({
    ...(capabilities.select ? { select: types.optional(entitySelect(entity)) } : {}),
    ...(capabilities.where ? { where: types.optional(entityWhere(entity)) } : {}),
    ...(capabilities.orderBy ? { orderBy: types.array(entityOrderBy(entity)).optional() } : {}),
    ...(capabilities.skip ? { skip: types.integer({ minimum: 0 }).optional() } : {}),
    ...(capabilities.take ? { take: types.integer({ minimum: 0, maximum: 20 }).optional() } : {}),
    //distinct: types.unknown(), //TODO
  })
}

const entitySelect = memoizeTypeTransformation<types.Lazy<types.EntityType<types.Mutability, types.Types>>>((type) => {
  const entity = types.concretise(type)
  return () =>
    types.object(
      mapObject(entity.fields, (_, fieldType) => types.optional(select(fieldType))),
      { name: `${entity.options?.name ?? randomUUID()}Select` },
    )
})

function select(type: types.Type): types.Type {
  return types.match(type, {
    wrapper: ({ wrappedType }) => select(wrappedType),
    array: ({ wrappedType }) => {
      const matcher: (type: types.Type) => types.Type = types.matcher({
        wrapper: ({ wrappedType }) => matcher(wrappedType),
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
    object: ({ fields }) =>
      types.union({
        fields: types.object({
          select: types.object(mapObject(fields, (_, fieldType) => types.optional(select(fieldType)))).optional(),
        }),
        all: types.boolean(),
      }),
    otherwise: () => types.boolean(),
  })
}

const entityWhere: (type: types.Lazy<types.EntityType<types.Mutability, types.Types>>) => types.Type =
  memoizeTypeTransformation<types.Lazy<types.EntityType<types.Mutability, types.Types>>>((_, type) => {
    const entity = types.concretise(type)
    return () =>
      types.object(
        {
          ...flatMapObject(entity.fields, (fieldName, fieldType) => {
            const result = types.optional(where(fieldType))
            return result ? [[fieldName, result]] : []
          }),
          AND: types.array(entityWhere(type)).optional(),
          OR: types.array(entityWhere(type)).optional(),
          NOT: types.optional(entityWhere(type)),
        },
        { name: `${entity.options?.name ?? randomUUID()}Where` },
      )
  })

function where(type: types.Type): types.Type {
  return types.match(type, {
    wrapper: ({ wrappedType }) => where(wrappedType),
    array: ({ wrappedType }) => {
      const matcher: (type: types.Type) => types.Type = types.matcher({
        wrapper: ({ wrappedType }) => matcher(wrappedType), //isSet
        scalar: (t) => types.object({ equals: types.optional(types.array(t)) }),
        array: () => {
          throw new Error('Array of array not supported in where')
        },
        entity: (_, t) => {
          const fieldWhereType = entityWhere(t)
          return types.object({
            some: types.optional(fieldWhereType),
            every: types.optional(fieldWhereType),
            none: types.optional(fieldWhereType),
          })
        },
        object: ({ fields }, t) => {
          return types.object({
            equals: types.optional(types.object(fields).array()),
            isEmpty: types.boolean().optional(),
          })
        },
        otherwise: () => {
          throw new Error('Unsupported where field')
        },
      })
      return matcher(wrappedType)
    },
    object: ({ fields }) => types.object({ equals: types.object(fields).optional() }),
    union: () => {
      throw new Error('Unsupported union in where')
    },
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

export const sortDirection = () => types.enumeration(['asc', 'desc'], { name: 'SortDirection' })
export type SortDirection = types.Infer<typeof sortDirection>

function orderBy(type: types.Type): types.Type {
  return types.match(type, {
    wrapper: ({ wrappedType }) => orderBy(wrappedType),
    array: () => types.object({ _count: types.optional(sortDirection) }),
    entity: (_, entity) => entityOrderBy(entity),
    object: ({ fields }) => types.object(mapObject(fields, (_, fieldType) => types.optional(orderBy(fieldType)))),
    otherwise: () => sortDirection,
  })
}

/**
 * TODO
 */
export type MergeOptions = {
  orderByOrder?: 'left-before' | 'right-before'
  skipOrder?: 'left-before' | 'right-before'
  takeOrder?: 'left-before' | 'right-before'
}
/**
 * TODO
 * @param type
 * @param left
 * @param right
 * @param options
 * @returns
 */
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
    record: ({ fields }) => {
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
              {
                select: mapObject(unwrappedFieldType.fields, (_, t) =>
                  types.unwrap(t).kind !== types.Kind.Entity ? true : undefined,
                ),
              },
              rightSelect,
              options,
            )
          }
          if (rightSelect === true && leftSelect !== true) {
            return merge(
              unwrappedFieldType,
              leftSelect,
              {
                select: mapObject(unwrappedFieldType.fields, (_, t) =>
                  types.unwrap(t).kind !== types.Kind.Entity ? true : undefined,
                ),
              },
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
          return { select: mergeSelect(fieldType, rightSelect.select, leftSelect.select) }
        }
      })
    },
    wrapper: ({ wrappedType }) => mergeSelect(wrappedType, left, right, options),
    otherwise: () => left ?? right,
  })
}
