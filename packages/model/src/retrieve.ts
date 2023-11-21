import { result, model } from '.'
import { memoizeTypeTransformation } from './utils'
import { flatMapObject, mapObject } from '@mondrian-framework/utils'
import { randomUUID } from 'crypto'

/**
 * Express the retrieve capabilities of a type or a function
 *  - where: it can be filtered
 *  - select: can select a sub-type
 *  - orderBy: can be sorted
 *  - take: (if list) can be limited to a fixed size
 *  - skip: can skip first results
 */
export type Capabilities = {
  where?: true
  select?: true
  orderBy?: true
  take?: true
  skip?: true
}

/**
 * Definition of a generic retrieve type.
 * It should be equals to prisma args.
 */
export type GenericRetrieve = {
  where?: GenericWhere
  select?: GenericSelect
  orderBy?: GenericOrderBy
  take?: number
  skip?: number
}
export type GenericWhere = { readonly AND?: GenericWhere | readonly GenericWhere[] } & { readonly [K in string]: any }
export type GenericSelect = null | { readonly [K in string]?: GenericRetrieve | boolean }
export type GenericOrderBy = {} | {}[]

/**
 * Builds a retrieve type of a known mondrian type.
 */
// prettier-ignore
export type FromType<T extends model.Type, C extends Capabilities | undefined>
  = [model.Type] extends [T] ? GenericRetrieve 
  : [C] extends [Capabilities] ? [C] extends [never] ? never
  : [T] extends [model.EntityType<any, any>] ? WhereType<T, C> & SelectType<T, C> & OrderByType<T, C> & TakeType<C> & SkipType<C>
  : [T] extends [model.ArrayType<any, infer T1>] ? FromType<T1, C>
  : [T] extends [model.OptionalType<infer T1>] ? FromType<T1, C>
  : [T] extends [model.NullableType<infer T1>] ? FromType<T1, C>
  : [T] extends [(() => infer T1 extends model.Type)] ? FromType<T1, C>
  : never : never

type TakeType<C extends Capabilities> = [C] extends [{ readonly take: true }] ? { readonly take?: number } : {}
type SkipType<C extends Capabilities> = [C] extends [{ readonly skip: true }] ? { readonly skip?: number } : {}

export type AllCapabilities = typeof allCapabilities
export const allCapabilities = { orderBy: true, select: true, skip: true, take: true, where: true } as const

// prettier-ignore
type SelectType<T extends model.Type, C extends Capabilities>
  = [C] extends [{ readonly select: true }]
  ? [T] extends [model.EntityType<any, infer Ts>] ? { readonly select?: { readonly [K in keyof Ts]?: boolean | SelectType<Ts[K], { select: true }> } } & WhereType<T, C>
  : [T] extends [model.ObjectType<any, infer Ts>] ? { readonly select?: { readonly [K in keyof Ts]?: boolean | SelectType<Ts[K], { select: true }> } }
  : [T] extends [model.ArrayType<any, infer T1>] ? SelectType<T1, AllCapabilities>
  : [T] extends [model.OptionalType<infer T1>] ? SelectType<T1, C>
  : [T] extends [model.NullableType<infer T1>] ? SelectType<T1, C>
  : [T] extends [(() => infer T1 extends model.Type)] ? SelectType<T1, C>
  : never : {}

// prettier-ignore
type OrderByType<T extends model.Type, C extends Capabilities>
  = [C] extends [{ readonly orderBy: true }]
  ? [T] extends [model.EntityType<any, infer Ts>] ? { readonly orderBy?: OrderByFields<Ts>[] } 
  : [T] extends [model.ArrayType<any, infer T1>] ? SelectType<T1, AllCapabilities>
  : [T] extends [model.OptionalType<infer T1>] ? SelectType<T1, C>
  : [T] extends [model.NullableType<infer T1>] ? SelectType<T1, C>
  : [T] extends [(() => infer T1 extends model.Type)] ? SelectType<T1, C>
  : never : {}

type OrderByFields<Ts extends model.Types> = { readonly [K in keyof Ts]?: OrderByField<Ts[K]> }
// prettier-ignore
type OrderByField<T extends model.Type> 
  = [T] extends [model.EntityType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [model.ObjectType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [model.ArrayType<any, any>] ? { readonly _count?: SortDirection }
  : [T] extends [model.OptionalType<infer T1>] ? OrderByField<T1>
  : [T] extends [model.NullableType<infer T1>] ? OrderByField<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? OrderByField<T1>
  : SortDirection

// prettier-ignore
type WhereType<T extends model.Type, C extends Capabilities> 
  = [C] extends [{ readonly where: true }]
  ? [T] extends [model.EntityType<any, infer Ts>] ? { readonly where?: WhereFields<Ts> }
  : [T] extends [model.ArrayType<any, infer T1>] ? WhereType<T1, AllCapabilities>
  : [T] extends [model.OptionalType<infer T1>] ? WhereType<T1, C>
  : [T] extends [model.NullableType<infer T1>] ? WhereType<T1, C>
  : [T] extends [(() => infer T1 extends model.Type)] ? WhereType<T1, C>
  : never : {}

type WhereFields<Ts extends model.Types> = { readonly [K in keyof Ts]?: WhereField<Ts[K]> } & {
  readonly AND?: WhereFields<Ts>[]
  readonly OR?: WhereFields<Ts>[]
  readonly NOT?: WhereFields<Ts>
}
// prettier-ignore
type WhereField<T extends model.Type> 
  = [T] extends [model.EntityType<any, infer Ts>] ? WhereFields<Ts>
  : [T] extends [model.ArrayType<any, infer T1>] ? WhereFieldArray<T1>
  : [T] extends [model.StringType] ? { readonly equals?: string }
  : [T] extends [model.ObjectType<any, any>] ? { readonly equals?: model.Infer<T> }
  : [T] extends [model.EntityType<any, infer Ts>] ? WhereFields<Ts>
  : [T] extends [model.OptionalType<infer T1>] ? WhereField<T1>
  : [T] extends [model.NullableType<infer T1>] ? WhereField<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? WhereField<T1>
  : undefined

// prettier-ignore
type WhereFieldArray<T extends model.Type> 
  = [T] extends [model.EntityType<any, infer Ts>] ? { readonly some?: WhereFields<Ts>; readonly every?: WhereFields<Ts>, readonly none?: WhereFields<Ts> }
  : [T] extends [model.OptionalType<infer T1>] ? WhereFieldArray<T1>
  : [T] extends [model.NullableType<infer T1>] ? WhereFieldArray<T1>
  : [T] extends [model.StringType] ? { readonly equals?: readonly string[], readonly isEmpty?: boolean }
  : [T] extends [model.ObjectType<any, any>] ? { readonly equals?: readonly model.Infer<T>[], readonly isEmpty?: boolean }
  : [T] extends [(() => infer T1 extends model.Type)] ? WhereFieldArray<T1>
  : undefined

/**
 * Gets the depth of the selection.
 * @param type {@link model.Type Type} to follow in order to cimpute the depth.
 * @param retrieve retrieve instance with the selection
 * @returns the selection depth
 */
export function selectionDepth<T extends model.Type>(type: T, retrieve: FromType<T, { select: true }>): number {
  return model.match(type, {
    wrapper: ({ wrappedType }) => selectionDepth(wrappedType, retrieve),
    entity: ({ fields }) =>
      Object.entries(fields)
        .map(([fieldName, fieldType]) => {
          if (!retrieve.select) {
            return 1
          }
          const unwrappedFieldType = model.unwrap(fieldType)
          if (unwrappedFieldType.kind === model.Kind.Entity && typeof retrieve.select[fieldName] === 'object') {
            return selectionDepth(fieldType, retrieve.select[fieldName] as GenericRetrieve) + 1
          } else if (unwrappedFieldType.kind === model.Kind.Entity && retrieve.select[fieldName] === true) {
            return 2
          } else {
            return 1
          }
        })
        .reduce((p, c) => Math.max(p, c), 0),
    otherwise: () => 1,
  })
}

/**
 * Makes optionals all fields that are entity type.
 */
function optionalizeEmbeddedEntities(type: model.Type): model.Type {
  function optionalizeEntityFields(fields: model.Types): model.Types {
    return flatMapObject(fields, (fieldName, fieldType) =>
      model.unwrap(fieldType).kind === model.Kind.Entity
        ? [[fieldName, model.optional(fieldType)]]
        : [[fieldName, fieldType]],
    )
  }
  return model.match(type, {
    optional: ({ wrappedType }) => model.optional(optionalizeEmbeddedEntities(wrappedType)),
    nullable: ({ wrappedType }) => model.nullable(optionalizeEmbeddedEntities(wrappedType)),
    array: ({ wrappedType }) => model.array(optionalizeEmbeddedEntities(wrappedType)),
    entity: ({ fields }) => model.entity(optionalizeEntityFields(fields)),
    object: ({ fields }) => model.object(optionalizeEntityFields(fields)),
    union: ({ variants }) =>
      model.union(mapObject(variants, (_, variantType) => optionalizeEmbeddedEntities(variantType))),
    otherwise: (_, t) => t,
  })
}

/**
 * Gets a projected {@link model.Type Type} in function of the given type and the retrieve selection.
 * @param type the root type.
 * @param retrieve the retrieve with a selection.
 * @returns the specific sub-type of the root type.
 */
export function selectedType<T extends model.Type>(
  type: T,
  retrieve: FromType<T, { select: true }> | undefined,
): model.Type {
  const select = retrieve?.select
  if (!select) {
    return optionalizeEmbeddedEntities(type)
  }
  return model.match(type, {
    optional: ({ wrappedType }) => model.optional(selectedType(wrappedType, retrieve)),
    nullable: ({ wrappedType }) => model.nullable(selectedType(wrappedType, retrieve)),
    array: ({ wrappedType }) => model.array(selectedType(wrappedType, retrieve)),
    record: ({ fields }) => {
      const selectedFields = flatMapObject(fields, (fieldName, fieldType) => {
        const selection = select[fieldName]
        if (selection === true) {
          return [[fieldName, optionalizeEmbeddedEntities(fieldType)]]
        } else if (typeof selection === 'object' && selection.select) {
          return [[fieldName, selectedType(fieldType, selection)]]
        } else if (typeof selection === 'object') {
          return [[fieldName, optionalizeEmbeddedEntities(fieldType)]]
        } else {
          return []
        }
      })
      return model.object(selectedFields)
    },
    otherwise: (_, t) => t,
  })
}

/**
 * Gets the mondrian retrieve type of the given mondrian type.
 */
export function fromType(
  type: model.Type,
  capabilities: Capabilities | undefined,
): result.Result<model.ObjectType<model.Mutability.Immutable, model.Types>, null> {
  if (!capabilities || Object.keys(capabilities).length === 0) {
    return result.fail(null)
  }
  const res = model.match(type, {
    wrapper: ({ wrappedType }) => fromType(wrappedType, capabilities),
    entity: (_, type) => result.ok(retrieve(type, capabilities)),
    otherwise: () => result.fail(null),
  }) as result.Result<model.Type, null>
  return res as result.Result<model.ObjectType<model.Mutability.Immutable, model.Types>, null>
}

function retrieve(
  entity: model.Lazy<model.EntityType<any, any>>,
  capabilities: Capabilities,
): model.ObjectType<model.Mutability.Immutable, model.Types> {
  return model.object({
    ...(capabilities.select ? { select: model.optional(entitySelect(entity)) } : {}),
    ...(capabilities.where ? { where: model.optional(entityWhere(entity)) } : {}),
    ...(capabilities.orderBy ? { orderBy: model.array(entityOrderBy(entity)).optional() } : {}),
    ...(capabilities.skip ? { skip: model.integer({ minimum: 0 }).optional() } : {}),
    ...(capabilities.take ? { take: model.integer({ minimum: 0, maximum: 20 }).optional() } : {}),
    //distinct: model.unknown(),
  })
}

const entitySelect = memoizeTypeTransformation<model.Lazy<model.EntityType<model.Mutability, model.Types>>>((type) => {
  const entity = model.concretise(type)
  return () =>
    model.object(
      mapObject(entity.fields, (_, fieldType) => model.optional(select(fieldType))),
      { name: `${entity.options?.name ?? randomUUID()}Select` },
    )
})

function select(type: model.Type): model.Type {
  return model.match(type, {
    wrapper: ({ wrappedType }) => select(wrappedType),
    array: ({ wrappedType }) => {
      const matcher: (type: model.Type) => model.Type = model.matcher({
        wrapper: ({ wrappedType }) => matcher(wrappedType),
        array: () => {
          throw new Error('Array of array not supported in selection')
        },
        entity: (_, entity) =>
          model.union({
            retrieve: retrieve(entity, { orderBy: true, select: true, skip: true, take: true, where: true }),
            all: model.boolean(),
          }),
        otherwise: (_, type) => select(type),
      })
      return matcher(wrappedType)
    },
    entity: (_, entity) =>
      model.union({
        retrieve: retrieve(entity, { select: true }),
        all: model.boolean(),
      }),
    object: ({ fields }) =>
      model.union({
        fields: model.object({
          select: model.object(mapObject(fields, (_, fieldType) => model.optional(select(fieldType)))).optional(),
        }),
        all: model.boolean(),
      }),
    otherwise: () => model.boolean(),
  })
}

const entityWhere: (type: model.Lazy<model.EntityType<model.Mutability, model.Types>>) => model.Type =
  memoizeTypeTransformation<model.Lazy<model.EntityType<model.Mutability, model.Types>>>((_, type) => {
    const entity = model.concretise(type)
    return () =>
      model.object(
        {
          ...flatMapObject(entity.fields, (fieldName, fieldType) => {
            const result = model.optional(where(fieldType))
            return result ? [[fieldName, result]] : []
          }),
          AND: model.array(entityWhere(type)).optional(),
          OR: model.array(entityWhere(type)).optional(),
          NOT: model.optional(entityWhere(type)),
        },
        { name: `${entity.options?.name ?? randomUUID()}Where` },
      )
  })

function where(type: model.Type): model.Type {
  return model.match(type, {
    wrapper: ({ wrappedType }) => where(wrappedType),
    array: ({ wrappedType }) => {
      const matcher: (type: model.Type) => model.Type = model.matcher({
        wrapper: ({ wrappedType }) => matcher(wrappedType), //isSet
        scalar: (_, t) => model.object({ equals: model.optional(model.array(t)) }),
        array: () => {
          throw new Error('Array of array not supported in where')
        },
        entity: (_, t) => {
          const fieldWhereType = entityWhere(t)
          return model.object({
            some: model.optional(fieldWhereType),
            every: model.optional(fieldWhereType),
            none: model.optional(fieldWhereType),
          })
        },
        object: ({ fields }) => {
          return model.object({
            equals: model.optional(model.object(fields).array()),
            isEmpty: model.boolean().optional(),
          })
        },
        otherwise: () => {
          throw new Error('Unsupported where field')
        },
      })
      return matcher(wrappedType)
    },
    object: ({ fields }) => model.object({ equals: model.object(fields).optional() }),
    union: () => {
      throw new Error('Unsupported union in where')
    },
    entity: (_, entity) => entityWhere(entity),
    scalar: (_, t) => model.object({ equals: model.optional(t) }),
  })
}

const entityOrderBy = memoizeTypeTransformation<model.Lazy<model.EntityType<model.Mutability, model.Types>>>((type) => {
  const entity = model.concretise(type)
  return model.object(
    mapObject(entity.fields, (_, fieldType) => model.optional(orderBy(fieldType))),
    { name: `${entity.options?.name ?? randomUUID()}OrderBy` },
  )
})

export const sortDirection = () => model.enumeration(['asc', 'desc'], { name: 'SortDirection' })
export type SortDirection = model.Infer<typeof sortDirection>

function orderBy(type: model.Type): model.Type {
  return model.match(type, {
    wrapper: ({ wrappedType }) => orderBy(wrappedType),
    array: () => model.object({ _count: model.optional(sortDirection) }),
    entity: (_, entity) => entityOrderBy(entity),
    object: ({ fields }) => model.object(mapObject(fields, (_, fieldType) => model.optional(orderBy(fieldType)))),
    otherwise: () => sortDirection,
  })
}

export type MergeOptions = {
  orderByOrder?: 'left-before' | 'right-before'
  skipOrder?: 'left-before' | 'right-before'
  takeOrder?: 'left-before' | 'right-before'
}

/**
 * Merges two retrieves. The logic can be modified by the options.
 */
export function merge<const T extends GenericRetrieve>(
  type: model.Type,
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
  type: model.Type,
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
  return model.match(type, {
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
        const unwrappedFieldType = model.unwrap(fieldType)
        if (unwrappedFieldType.kind === model.Kind.Entity) {
          if (leftSelect === true && rightSelect === true) {
            return true
          }
          if (leftSelect === true && rightSelect !== true) {
            return merge(
              unwrappedFieldType,
              {
                select: mapObject(unwrappedFieldType.fields, (_, t) =>
                  model.unwrap(t).kind !== model.Kind.Entity ? true : undefined,
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
                  model.unwrap(t).kind !== model.Kind.Entity ? true : undefined,
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
