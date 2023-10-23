import { result, types } from '.'
import { failWithInternalError, memoizeTypeTransformation, memoizeTransformation } from './utils'
import { flatMapObject, mapObject } from '@mondrian-framework/utils'
import { randomUUID } from 'crypto'

export type GenericRetrieve = {
  where?: GenericWhere
  select?: GenericSelect
  orderBy?: GenericOrderBy
  take?: number
  skip?: number
}
export type GenericWhere = { AND?: GenericWhere | GenericWhere[] }
export type GenericSelect = null | {}
export type GenericOrderBy = {} | {}[]

// prettier-ignore
export type FromType<T extends types.Type> = GenericRetrieve /* TODO
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
  return {
    where: { AND: [left.where, right.where] },
    orderBy:
      options?.orderByOrder === 'right-before' ? [...rightOrderBy, ...leftOrderBy] : [...leftOrderBy, ...rightOrderBy],
    skip: options?.skipOrder === 'right-before' ? right.skip ?? left.skip : left.skip ?? right.skip,
    take: options?.takeOrder === 'right-before' ? right.take ?? left.take : left.take ?? right.take,
    //select: TODO merge select by following type
  } as unknown as T
}

export function selectionDepth(retrieve: GenericRetrieve): number {
  //TODO: better to follow an entity type
  function selectionDepth(retrieve: GenericRetrieve, depth: number): number {
    if (retrieve.select) {
      return Object.values(retrieve.select)
        .map((selected) => {
          if (typeof selected === 'object' && selected) {
            return selectionDepth(selected, depth + 1)
          }
          return depth
        })
        .reduce((p, c) => Math.max(p, c), 0)
    } else {
      return depth
    }
  }
  return selectionDepth(retrieve, 1)
}

export function isRespected<T extends types.Type>(
  type: T,
  retrieve: FromType<T>,
  value: types.Infer<T>,
): result.Result<{ trimmedValue: types.Infer<T> }, any> {
  return result.ok({ trimmedValue: value }) //TODO
}

export function fromType(type: types.Type): result.Result<types.Type, null> {
  if (types.isArray(type)) {
    const t = multiEntityRetrieve(types.unwrap(type))
    if (types.isNever(t)) {
      return result.fail(null)
    } else {
      return result.ok(t)
    }
  } else {
    const t = singleEntityRetrieve(types.unwrap(type))
    if (types.isNever(t)) {
      return result.fail(null)
    } else {
      return result.ok(t)
    }
  }
}

const singleEntityRetrieve = memoizeTypeTransformation(
  types.matcher({
    entity: (concreteEntity, entity) =>
      types.object(
        { select: types.optional(entitySelect(entity)) },
        { name: `${concreteEntity.options?.name ?? randomUUID()}SingleRetrieve` },
      ),
    otherwise: () => types.never(),
  }),
)

const multiEntityRetrieve = memoizeTypeTransformation(
  types.matcher({
    entity: (concreteEntity, entity) =>
      types.object(
        {
          where: types.optional(entityWhere(entity)),
          select: types.optional(entitySelect(entity)),
          orderBy: types.optional(types.array(entityOrderBy(entity))),
          //distinct: types.unknown(), //TODO: need untagged union
          skip: types.integer({ minimum: 0 }).optional(),
          take: types.integer({ minimum: 0, maximum: 20 }).optional(),
        },
        { name: `${concreteEntity.options?.name ?? randomUUID()}MultiRetrieve` },
      ),
    otherwise: () => types.never(),
  }),
)

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
      entity: (_, entity) => multiEntityRetrieve(entity),
      otherwise: (_, type) => select(type),
    })
    return matcher(wrappedType)
  },
  entity: (_, entity) => singleEntityRetrieve(entity), //TODO: or true
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
