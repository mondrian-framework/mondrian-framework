import { result, model, utils } from '@mondrian-framework/model'
import { flatMapObject, mapObject } from '@mondrian-framework/utils'
import { randomUUID } from 'crypto'

/**
 * Definition of a generic retrieve type.
 * It should be equals to prisma args.
 */
export type GenericRetrieve = {
  readonly select?: GenericSelect
  readonly where?: GenericWhere
  readonly orderBy?: GenericOrderBy
  readonly take?: number
  readonly skip?: number
}
export type GenericWhere = {
  readonly AND?: GenericWhere | readonly GenericWhere[]
  readonly OR?: GenericWhere | readonly GenericWhere[]
  readonly NOT?: GenericWhere | readonly GenericWhere[]
} & { readonly [K in string]: any }
export type GenericSelect = null | { readonly [K in string]?: GenericRetrieve | boolean }
type GenericOrderByInternal = { [K in string]: SortDirection | GenericOrderByInternal }
export type GenericOrderBy = GenericOrderByInternal | GenericOrderByInternal[]

/**
 * Express the retrieve capabilities of a type or a function
 *  - select: can select a sub-type
 *  - where: it can be filtered
 *  - orderBy: can be sorted
 *  - take: (if list) can be limited to a fixed size
 *  - skip: can skip first results
 */
export type FunctionCapabilities = {
  readonly select?: true
  readonly where?: true
  readonly orderBy?: true
  readonly take?: true
  readonly skip?: true
}

export type AllCapabilities = typeof allCapabilities

export const allCapabilities = {
  orderBy: true,
  select: true,
  skip: true,
  take: true,
  where: true,
} as const satisfies FunctionCapabilities

/**
 * Builds a retrieve type of a known mondrian type.
 */
// prettier-ignore
export type FromType<T extends model.Type, C extends FunctionCapabilities | undefined>
  = [model.Type] extends [T] ? GenericRetrieve 
  : [C] extends [FunctionCapabilities] ? [C] extends [never] ? never
  : [T] extends [model.EntityType<any, any>] ? Retrieve<T, C>
  : [T] extends [model.ArrayType<any, infer T1>] ? FromType<T1, C>
  : [T] extends [model.OptionalType<infer T1>] ? FromType<T1, C>
  : [T] extends [model.NullableType<infer T1>] ? FromType<T1, C>
  : [T] extends [(() => infer T1 extends model.Type)] ? FromType<T1, C>
  : never : never

/**
 * Gets the mondrian retrieve type of the given mondrian type.
 */
export function fromType(
  type: model.Type,
  functionCapabilities: FunctionCapabilities | undefined,
): result.Result<model.ObjectType<model.Mutability.Immutable, model.Types>, null> {
  if (!functionCapabilities || Object.keys(functionCapabilities).length === 0) {
    return result.fail(null)
  }
  const res = model.match(type, {
    wrapper: ({ wrappedType }) => fromType(wrappedType, functionCapabilities),
    entity: (_, type) => result.ok(retrieve(type, functionCapabilities)),
    otherwise: () => result.fail(null),
  }) as result.Result<model.Type, null>
  return res as result.Result<model.ObjectType<model.Mutability.Immutable, model.Types>, null>
}

/**
 * The retrieve type of an entity
 */
//prettier-ignore
type Retrieve<T extends model.Lazy<model.EntityType<any, any>>, C extends FunctionCapabilities> = 
  SelectType<T, C> &
  WhereType<T, C> &
  OrderByType<T, C> &
  TakeType<C> &
  SkipType<C>

/**
 * Builds the retrieve type of an entity with the given capabilities.
 */
function retrieve(
  entity: model.Lazy<model.EntityType<any, any>>,
  capabilities: FunctionCapabilities,
): model.ObjectType<model.Mutability.Immutable, model.Types> {
  const options = model.concretise(entity).options?.retrieve
  const maxSkip = typeof options?.skip === 'object' ? options.skip.max : undefined
  const maxTake = typeof options?.take === 'object' ? options.take.max : 20
  return model.object({
    ...(capabilities.select ? { select: model.optional(select(entity)) } : {}),
    ...(capabilities.where && options?.where ? { where: model.optional(where(entity)) } : {}),
    ...(capabilities.orderBy && options?.orderBy ? { orderBy: model.array(orderBy(entity)).optional() } : {}),
    ...(capabilities.skip && options?.skip
      ? { skip: model.integer({ minimum: 0, maximum: maxSkip }).optional({ defaultDecodeValue: 0 }) }
      : {}),
    ...(capabilities.take && options?.take
      ? { take: model.integer({ minimum: 0, maximum: maxTake }).optional({ defaultDecodeValue: maxTake }) }
      : {}),
  })
}

type SelectType<T extends model.Type, C extends FunctionCapabilities> = [C] extends [{ readonly select: true }]
  ? { readonly select?: Select<T> }
  : {}
type WhereType<T extends model.Type, C extends FunctionCapabilities> = [C] extends [{ readonly where: true }]
  ? { readonly where?: Where<T> }
  : {}
type OrderByType<T extends model.Type, C extends FunctionCapabilities> = [C] extends [{ readonly orderBy: true }]
  ? { readonly orderBy?: OrderBy<T>[] }
  : {}
type TakeType<C extends FunctionCapabilities> = [C] extends [{ readonly take: true | { readonly max: number } }]
  ? { readonly take?: number }
  : {}
type SkipType<C extends FunctionCapabilities> = [C] extends [{ readonly skip: true | { readonly max: number } }]
  ? { readonly skip?: number }
  : {}

///////////////////
////////// SELECT
///////////////////

// prettier-ignore
type Select<T extends model.Type>
  = [T] extends [model.EntityType<any, infer Ts>] ? { readonly [K in keyof Ts]?: SelectField<Ts[K], { select: true }> }
  : [T] extends [model.ObjectType<any, infer Ts>] ? { readonly [K in keyof Ts]?: SelectField<Ts[K], { select: true }> }
  : [T] extends [model.OptionalType<infer T1>] ? Select<T1>
  : [T] extends [model.NullableType<infer T1>] ? Select<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? Select<T1>
  : boolean

const select = utils.memoizeTypeTransformation(selectInternal)
function selectInternal(type: model.Type): model.Type {
  return model.match(type, {
    record: ({ fields, options }) =>
      model.object(
        mapObject(fields, (_, fieldType) => model.optional(selectField(fieldType, { select: true }))),
        { name: `${options?.name ?? randomName()}Select` },
      ),
    wrapper: ({ wrappedType }) => select(wrappedType),
    otherwise: () => model.boolean(),
  })
}

// prettier-ignore
type SelectField<T extends model.Type, C extends FunctionCapabilities>
  = [T] extends [model.EntityType<any, any>] ? Retrieve<T, C>
  : [T] extends [model.ObjectType<any, infer Ts>] ? boolean | { readonly select?: { [K in keyof Ts]?: SelectField<Ts[K], { select: true }> } }
  : [T] extends [model.ArrayType<any, infer T1>] ? SelectField<T1, AllCapabilities>
  : [T] extends [model.OptionalType<infer T1>] ? SelectField<T1, C>
  : [T] extends [model.NullableType<infer T1>] ? SelectField<T1, C>
  : [T] extends [(() => infer T1 extends model.Type)] ? SelectField<T1, C>
  : boolean

function selectField(type: model.Type, capabilities: FunctionCapabilities): model.Type {
  return model.match(type, {
    entity: (_, entity) => retrieve(entity, capabilities),
    object: ({ fields }) =>
      model.union({
        fields: model.object({
          select: model
            .object(mapObject(fields, (_, fieldType) => model.optional(selectField(fieldType, { select: true }))))
            .optional(),
        }),
        all: model.boolean(),
      }),
    custom: ({ options }) => (options?.apiType ? selectField(options.apiType, capabilities) : model.boolean()),
    array: ({ wrappedType }) => selectField(wrappedType, allCapabilities),
    wrapper: ({ wrappedType }) => selectField(wrappedType, capabilities),
    otherwise: () => model.boolean(),
  })
}

///////////////////
////////// ORDER BY
///////////////////

// prettier-ignore
type OrderBy<T extends model.Type>
  = [T] extends [model.EntityType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [model.ObjectType<any, infer Ts>] ? OrderByFields<Ts>
  : [T] extends [model.ArrayType<any, infer T1>] ? OrderByArray<T1>
  : [T] extends [model.OptionalType<infer T1>] ? OrderBy<T1>
  : [T] extends [model.NullableType<infer T1>] ? OrderBy<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? OrderBy<T1>
  : any //TODO: should be SortDirection but typescript has a bug https://github.com/microsoft/TypeScript/issues/53614

const orderBy = utils.memoizeTypeTransformation(orderByInternal)
function orderByInternal(type: model.Type): model.Type {
  return model.match(type, {
    object: ({ fields, options }) =>
      orderByFields(fields, { orderBy: true }, `${options?.name ?? randomName()}OrderBy`),
    entity: ({ fields, options }) =>
      orderByFields(fields, options?.retrieve, `${options?.name ?? randomName()}OrderBy`),
    array: ({ wrappedType }) => orderByArray(wrappedType),
    wrapper: ({ wrappedType }) => orderBy(wrappedType),
    otherwise: () => SortDirection,
  })
}

type OrderByFields<Ts extends model.Types> = { readonly [K in keyof Ts]?: OrderBy<Ts[K]> }

function orderByFields(
  fields: model.Types,
  capabilities?: model.RetrieveCapabilities,
  name?: string,
): model.ObjectType<any, any> {
  return model.object(
    flatMapObject(fields, (fieldName, fieldType) =>
      orderByFieldIsApplicable(fieldName, capabilities) ? [[fieldName, model.optional(orderBy(fieldType))]] : [],
    ),
    { name },
  )
}

function orderByFieldIsApplicable(fieldName: string, capabilities: model.RetrieveCapabilities | undefined): boolean {
  if (fieldName.startsWith('_')) {
    return false
  }
  if (!capabilities?.orderBy) {
    return false
  }
  if (capabilities.orderBy === true) {
    return true
  }
  return capabilities.orderBy[fieldName] === true
}

// prettier-ignore
type OrderByArray<T extends model.Type>
  = [T] extends [model.OptionalType<infer T1>] ? OrderByArray<T1>
  : [T] extends [model.NullableType<infer T1>] ? OrderByArray<T1>
  : [T] extends [model.EntityType<any, any>] ? { readonly _count?: SortDirection } 
  : [T] extends [model.ObjectType<any, any>] ? { readonly _count?: SortDirection } 
  : [T] extends [(() => infer T1 extends model.Type)] ? OrderByArray<T1>
  : any //TODO: should be SortDirection but typescript has a bug https://github.com/microsoft/TypeScript/issues/53614

function orderByArray(type: model.Type): model.Type {
  return model.match(type, {
    optional: ({ wrappedType }) => orderByArray(wrappedType),
    nullable: ({ wrappedType }) => orderByArray(wrappedType),
    entity: () => model.object({ _count: model.optional(SortDirection) }),
    object: () => model.object({ _count: model.optional(SortDirection) }),
    otherwise: () => SortDirection,
  })
}

export const SortDirection = () => model.enumeration(['asc', 'desc'], { name: 'SortDirection' })
export type SortDirection = model.Infer<typeof SortDirection>

///////////////////
////////// WHERE
///////////////////

// prettier-ignore
type Where<T extends model.Type> 
  = [T] extends [model.EntityType<any, any>] ? { readonly [K in keyof T['fields']]?: WhereField<T['fields'][K]> } & LogicWhereOperators<T>
  : [T] extends [model.OptionalType<infer T1>] ? Where<T1>
  : [T] extends [model.NullableType<infer T1>] ? Where<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? Where<T1>
  : never

const where = utils.memoizeTypeTransformation(whereInternal)
function whereInternal(type: model.Type): model.Type {
  const result = model.match(type, {
    entity:
      ({ fields, options }, entity) =>
      () =>
        model.object(
          {
            ...flatMapObject(fields, (fieldName, fieldType) => {
              return whereFieldIsApplicable(fieldName, options?.retrieve)
                ? [[fieldName, model.optional(whereField(fieldType))]]
                : []
            }),
            ...logicWhereOperators(entity, options?.retrieve),
          },
          { name: `${options?.name ?? randomName()}Where` },
        ),
    optional: ({ wrappedType }) => where(wrappedType),
    nullable: ({ wrappedType }) => where(wrappedType),
    otherwise: () => model.never(),
  })
  return result
}

function whereFieldIsApplicable(fieldName: string, capabilities: model.RetrieveCapabilities | undefined): boolean {
  if (fieldName.startsWith('_')) {
    return false
  }
  if (!capabilities?.where) {
    return false
  }
  if (capabilities.where === true) {
    return true
  }
  return capabilities.where[fieldName] ? true : false
}

type LogicWhereOperators<T extends model.Type> = {
  readonly AND?: Where<T>[]
  readonly OR?: Where<T>[]
  readonly NOT?: Where<T>
}

function logicWhereOperators(type: model.Type, capabilities: model.RetrieveCapabilities | undefined): model.Types {
  return {
    ...(whereFieldIsApplicable('AND', capabilities) ? { AND: model.optional(model.array(where(type))) } : {}),
    ...(whereFieldIsApplicable('OR', capabilities) ? { OR: model.optional(model.array(where(type))) } : {}),
    ...(whereFieldIsApplicable('NOT', capabilities) ? { NOT: model.optional(where(type)) } : {}),
  }
}

// prettier-ignore
type WhereField<T extends model.Type> 
  = [T] extends [model.EntityType<any, any>] ? Where<T>
  : [T] extends [model.ObjectType<any, any>] ? { readonly equals?: model.Infer<T> }
  : [T] extends [model.ArrayType<any, infer T1>] ? WhereFieldArray<T1>
  : [T] extends [model.CustomType<any, any, any>] ? { readonly equals?: model.Infer<T> }
  : [T] extends [model.OptionalType<infer T1>] ? WhereField<T1>
  : [T] extends [model.NullableType<infer T1>] ? WhereField<T1>
  : [T] extends [model.UnionType<any>] ? never
  : [T] extends [(() => infer T1 extends model.Type)] ? WhereField<T1>
  : { readonly equals?: model.Infer<T>, readonly in?: model.Infer<T>[] } | undefined

function whereField(type: model.Type): model.Type {
  return model.match(type, {
    entity: (_, entity) => where(entity),
    object: (_, object) => model.object({ equals: model.optional(object) }),
    array: ({ wrappedType }) => whereFieldArray(wrappedType),
    custom: (_, custom) => model.object({ equals: model.optional(custom) }),
    wrapper: ({ wrappedType }) => whereField(wrappedType),
    union: () => model.never(),
    otherwise: (_, t) =>
      model.object({ equals: model.optional(t), in: model.mutableArray(t, { minItems: 1, maxItems: 20 }).optional() }),
  })
}

// prettier-ignore
type WhereFieldArray<T extends model.Type> 
  = [T] extends [model.EntityType<any, any>] ? { readonly some?: Where<T>; readonly every?: Where<T>, readonly none?: Where<T> }
  : [T] extends [model.ObjectType<any, any>] ? { readonly equals?: model.Infer<T>[], readonly isEmpty?: boolean }
  : [T] extends [model.OptionalType<infer T1>] ? WhereFieldArray<T1>
  : [T] extends [model.NullableType<infer T1>] ? WhereFieldArray<T1>
  : [T] extends [model.UnionType<any>] ? never
  : [T] extends [(() => infer T1 extends model.Type)] ? WhereFieldArray<T1>
  : { readonly equals?: model.Infer<T>[], readonly isEmpty?: boolean }

function whereFieldArray(type: model.Type): model.Type {
  return model.match(type, {
    entity: (_, entity) =>
      model.object({
        some: model.optional(where(entity)),
        every: model.optional(where(entity)),
        none: model.optional(where(entity)),
      }),
    object: (_, object) =>
      model.object({ equals: model.optional(model.mutableArray(object)), isEmpty: model.boolean().optional() }),
    optional: ({ wrappedType }) => whereFieldArray(wrappedType),
    nullable: ({ wrappedType }) => whereFieldArray(wrappedType),
    union: () => model.never(),
    otherwise: (_, t) => model.object({ equals: model.optional(model.array(t)), isEmpty: model.boolean().optional() }),
  })
}

///////////////////
////////// UTILS
///////////////////

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

export function mergeSelect(
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
        //TODO: if one is undefined it means that we are selecting all root fields
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

/**
 * Gets a projected {@link model.Type Type} in function of the given type and the retrieve selection.
 * @param type the root type.
 * @param retrieve the retrieve with a selection.
 * @returns the specific sub-type of the root type.
 */
export function selectedType<T extends model.Type>(type: T, retrieve: GenericRetrieve | undefined): model.Type {
  const select = retrieve?.select
  if (!select) {
    return optionalizeEmbeddedEntities(type)
  }
  return model.match(type, {
    wrapper: ({ wrappedType }) => model.optional(selectedType(wrappedType, retrieve)),
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
 * Makes optionals all fields that are entity type.
 */
function optionalizeEmbeddedEntities(type: model.Type): model.Type {
  function optionalizeEntityFields(fields: model.Types): model.Types {
    return mapObject(fields, (fieldName, fieldType) => {
      if (fieldName.startsWith('_')) {
        return model.optional(model.partialDeep(fieldType))
      } else if (model.unwrap(fieldType).kind === model.Kind.Entity) {
        return model.optional(fieldType)
      } else {
        return fieldType
      }
    })
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
 * Gets the depth of the selection.
 * @param type {@link model.Type Type} to follow in order to cimpute the depth.
 * @param retrieve retrieve instance with the selection
 * @returns the selection depth
 */
export function selectionDepth<T extends model.Type>(type: T, retrieve: { select?: GenericSelect }): number {
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

function randomName() {
  return `_${randomUUID().split('-').join('')}`
}
