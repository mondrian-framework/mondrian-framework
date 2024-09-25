import { retrieve } from '.'
import { model, path, result } from '@mondrian-framework/model'
import { Mutable, flatMapObject, isArray } from '@mondrian-framework/utils'
import { isDeepStrictEqual } from 'util'

/**
 * A policy express what can be accessed for a specifi entity.
 *  - entity: the specific entity
 *  - selection: the fields that can be accessed
 *  - restriction: this policy is available only if this entity is retrieved with this restriction as where clausole
 *  - filter: if this policy is applied this filter will be added to the where clausole of the retrieve operation
 * In order to define some policies you can use the utility builder inside security module
 * ```ts
 * import { security } from '@mondrian-framework/module'
 *
 * const policies = security
 *   .on(YourEntity)
 *   .allows({ ... })
 *   .allows({ ... })
 * ```
 */
export type Policy<T extends model.Type = model.Type> = RetrievePolicy<T> | MapperPolicy<T>

type RetrievePolicy<T extends model.Type = model.Type> = {
  readonly entity: T
  readonly selection: boolean | Exclude<retrieve.FromType<T, { select: true }>['select'], null | undefined> //TODO: excluding connected entities?
  readonly restriction?:
    | (retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never })
    | null
  readonly filter?: retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never }
}

type MapperPolicy<T extends model.Type = model.Type> = {
  readonly mapper: (value: model.Infer<model.PartialDeep<T>>) => model.Infer<model.PartialDeep<T>>
}

/**
 * Represent a set of {@link Policy}
 */
export type Policies = {
  readonly retrievePolicies: ReadonlyMap<model.Type, RetrievePolicy[]>
  readonly mapperPolicies: ReadonlyMap<model.Type, MapperPolicy[]>
}

/**
 * The result type for {@link checkPolicies} operation.
 */
export type Result = result.Result<retrieve.GenericRetrieve | undefined, PolicyViolation>

/**
 * The mondrian type of a PolicyViolation error.
 */
export const PolicyViolation = () =>
  model.object(
    {
      path: model.string({ description: 'The requested resource path that caused the failure.' }),
      reasons: model
        .object({
          applicable: model.boolean({ description: 'If the policy was applicable' }),
          policy: model.json({ description: 'The policy that was checked' }),
          forbiddenAccess: model
            .string()
            .array({ description: 'The list of requested fields that was forbidden.' })
            .optional(),
        })
        .array(),
    },
    {
      name: 'PolicyViolationDetails',
      description: 'The details of a policy violation.',
    },
  )
export type PolicyViolation = model.Infer<typeof PolicyViolation>

/**
 * Information needed to perform a policy check.
 */
export type PolicyCheckInput = {
  readonly outputType: model.Type
  readonly policies: ReadonlyMap<model.Type, RetrievePolicy[]>
  readonly retrieve?: retrieve.GenericRetrieve
  readonly capabilities?: retrieve.FunctionCapabilities
  readonly path: path.Path
}

export type ApplyMapPolicyInput = {
  readonly outputType: model.Type
  readonly value: unknown
  readonly policies: ReadonlyMap<model.Type, MapperPolicy[]>
}

/**
 * Entry point of the map policies logic.
 */
export function applyMapPolicies({ outputType, policies, value }: ApplyMapPolicyInput): unknown {
  const typePolicies = policies.get(outputType) ?? []
  const mappedValue = typePolicies.reduce((v, { mapper }) => mapper(v as never), value)

  return model.match(outputType, {
    array: ({ wrappedType }) => {
      if (Array.isArray(mappedValue)) {
        return mappedValue.map((v) => applyMapPolicies({ outputType: wrappedType, policies, value: v }))
      } else {
        return mappedValue //should not happen
      }
    },
    nullable: ({ wrappedType }) => {
      if (mappedValue === null) {
        return mappedValue
      } else {
        return applyMapPolicies({ outputType: wrappedType, policies, value: mappedValue })
      }
    },
    optional: ({ wrappedType }) => {
      if (mappedValue === undefined) {
        return mappedValue
      } else {
        return applyMapPolicies({ outputType: wrappedType, policies, value: mappedValue })
      }
    },
    record: ({ fields }) => {
      if (typeof mappedValue === 'object' && mappedValue !== null) {
        return Object.fromEntries(
          Object.entries(fields).flatMap(([key, fieldType]) =>
            key in mappedValue
              ? [[key, applyMapPolicies({ outputType: fieldType, policies, value: (mappedValue as any)[key] })]]
              : [],
          ),
        )
      } else {
        return mappedValue //should not happen
      }
    },
    union: ({ variants }) => {
      const variant = Object.values(variants).find(
        (v) => model.concretise(model.partialDeep(v)).decode(mappedValue).isOk,
      )
      if (variant) {
        return applyMapPolicies({ outputType: variant, policies, value: mappedValue })
      } else {
        return mappedValue
      }
    },
    otherwise: () => mappedValue,
  })
}

/**
 * Entry point of the check policies logic.
 */
export function checkPolicies(args: PolicyCheckInput): Result {
  return checkPoliciesInternal(args).map((mappedRetrieve) => {
    return intersectRetrieveSelection(args.outputType, args.retrieve, mappedRetrieve)
  })
}

export function checkPoliciesInternal({
  outputType,
  policies,
  retrieve,
  capabilities,
  path,
}: PolicyCheckInput): Result {
  if (!capabilities || !capabilities.select || !retrieve) {
    return result.ok(retrieve)
  }

  const unwrapped = model.concretise(model.unwrapAndConcretize(outputType))
  if (unwrapped.kind !== model.Kind.Entity) {
    throw new Error('Should be an entity')
  }
  const mappedRetrieve = spreadWhereAndOrderByIntoSelection(unwrapped, retrieve)

  const appliedPolicies: RetrievePolicy[] = []
  const potentiallyPolicies: { policy: RetrievePolicy; forbiddenAccess: path.Path[] }[] = []
  const notSatisfiedPolicies: RetrievePolicy[] = []
  const thisPolicies = policies.get(model.unwrap(outputType)) ?? []
  for (const policy of thisPolicies) {
    if (!isWithinRestriction(policy, retrieve?.where)) {
      notSatisfiedPolicies.push(policy)
      continue
    }
    const selectionCheck = isSelectionIncluded(policy, mappedRetrieve?.select)
    if (selectionCheck.isFailure) {
      potentiallyPolicies.push({ policy: policy, forbiddenAccess: selectionCheck.error })
    } else {
      appliedPolicies.push(policy)
    }
  }

  if (appliedPolicies.length === 0) {
    return result.fail({
      path,
      reasons: [
        ...potentiallyPolicies.map(({ policy, forbiddenAccess }) => ({
          applicable: true,
          policy: { ...policy, entity: undefined },
          forbiddenAccess,
        })),
        ...notSatisfiedPolicies.map((policy) => ({
          applicable: false,
          policy: { ...policy, entity: undefined },
          forbiddenAccess: undefined,
        })),
      ],
    })
  }

  const filters = { OR: appliedPolicies.flatMap((p) => (p.filter ? [p.filter] : [])) }
  if (filters.OR.length > 0 && !capabilities.where) {
    const typeName = model.concretise(outputType).options?.name
    throw new Error(
      `You are trying to use a policy with filter on a function without where capability. Output type: ${typeName}`,
    )
  }
  const filterToUse = filters.OR.length === 1 ? filters.OR[0] : filters
  const newRetrieve =
    filters.OR.length === 0
      ? mappedRetrieve
      : {
          ...mappedRetrieve,
          where: retrieve?.where ? { AND: [retrieve.where, filterToUse] } : filterToUse,
        }

  return checkForRelations({ outputType, policies, retrieve: newRetrieve, capabilities, path })
}

/**
 * The {@link checkPoliciesInternal} operation will alter the select by adding
 * fields used by where and orderBy clausole. This function will restore the
 * original select.
 */
function intersectRetrieveSelection(
  type: model.Type,
  originalRetrieve: retrieve.GenericRetrieve | undefined,
  currenctRetrieve: retrieve.GenericRetrieve | undefined,
) {
  const originalSelect = originalRetrieve?.select
  const currentSelect = currenctRetrieve?.select
  if (!originalSelect || !currentSelect) {
    return currenctRetrieve
  }

  const unwrapped = model.unwrapAndConcretize(type)
  return model.match(unwrapped, {
    entity: ({ fields }) => {
      const selection: Mutable<retrieve.GenericSelect> = {}
      for (const [fieldName, fieldType] of Object.entries(fields)) {
        if (
          originalSelect[fieldName] &&
          currentSelect[fieldName] &&
          model.isEntity(model.unwrapAndConcretize(fieldType))
        ) {
          selection[fieldName] = intersectRetrieveSelection(
            fieldType,
            originalSelect[fieldName] as any,
            currentSelect[fieldName] as any,
          )
        } else if (originalSelect[fieldName] !== undefined) {
          selection[fieldName] = originalSelect[fieldName]
        }
      }
      return { ...currenctRetrieve, select: selection }
    },
    otherwise: () => {
      throw new Error('Unexpected type in intersectRetrieveSelection')
    },
  })
}

/**
 * This function will generate a new retrieve where the select will include
 * all fields used by where and orderBy
 */
function spreadWhereAndOrderByIntoSelection(
  type: model.EntityType<any, model.Types>,
  retr: retrieve.GenericRetrieve,
): retrieve.GenericRetrieve {
  let selection: retrieve.GenericSelect | undefined = retr?.select
  if (retr?.orderBy) {
    const orderBySelection = orderByToSelection(type, retr.orderBy)
    selection = retrieve.mergeSelect(type, selection, orderBySelection)
  }
  if (retr?.where) {
    const orderBySelection = whereToSelection(type, retr.where)
    selection = retrieve.mergeSelect(type, selection, orderBySelection)
  }
  if (selection === undefined) {
    return retr
  }
  return { ...retr, select: selection }
}

/**
 * This function creates a select with all fields used by the orderBy
 */
export function orderByToSelection(type: model.Type, orderBy: retrieve.GenericOrderBy): retrieve.GenericSelect {
  const unwrapped = model.unwrapAndConcretize(type)
  return (isArray(orderBy) ? orderBy : [orderBy])
    .map((order) => orderByToSelectionInternal(unwrapped, order))
    .reduce((p, c) => retrieve.mergeSelect(unwrapped, p, c)!, {})
}

function orderByToSelectionInternal(type: model.Type, order: any): any {
  return model.match(type, {
    record: ({ fields }) => {
      if (isDeepStrictEqual({ _count: 'asc' }, order) || isDeepStrictEqual({ _count: 'desc' }, order)) {
        return {}
      }
      const selection: Mutable<retrieve.GenericSelect> = {}
      for (const [fieldName, fieldType] of Object.entries(fields)) {
        const orderPart = order[fieldName]
        if (fieldName in order) {
          if (orderPart === 'asc' || orderPart === 'desc') {
            selection[fieldName] = true
          } else {
            selection[fieldName] = { select: orderByToSelection(fieldType, [orderPart]) }
          }
        }
      }
      return selection
    },
    otherwise: () => {
      throw new Error('Unreachable')
    },
  })
}

/**
 * This function creates a select with all fields used by the where clausole
 */
export function whereToSelection(type: model.Type, where: retrieve.GenericWhere): retrieve.GenericSelect {
  const logicalConditions = [
    ...(isArray(where?.AND) ? where?.AND : where?.AND ? [where.AND] : []),
    ...(isArray(where?.OR) ? where.OR : where?.OR ? [where.OR] : []),
    ...(isArray(where?.NOT) ? where.NOT : where?.NOT ? [where.NOT] : []),
  ]

  const selectionFromLogical = logicalConditions
    .map((where: retrieve.GenericWhere) => whereToSelection(type, where))
    .reduce((p, c) => retrieve.mergeSelect(type, p, c)!, {})

  const internalWhere = { ...where }
  delete internalWhere.AND
  delete internalWhere.OR
  delete internalWhere.NOT

  const selection = whereToSelectionInternal(type, internalWhere)
  return retrieve.mergeSelect(type, selection, selectionFromLogical)!
}

function whereToSelectionInternal(type: model.Type, where: any): any {
  return model.match(type, {
    record: ({ fields }) => {
      const selection: Mutable<retrieve.GenericSelect> = {}
      for (const [fieldName, fieldType] of Object.entries(fields)) {
        const wherePart = where[fieldName]
        if (fieldName in where) {
          if ('equals' in wherePart || 'in' in wherePart) {
            selection[fieldName] = true
          } else {
            selection[fieldName] = { select: whereToSelection(fieldType, wherePart) }
          }
        }
      }
      return selection
    },
    array: ({ wrappedType }) =>
      retrieve.mergeSelect(
        wrappedType,
        whereToSelection(wrappedType, where?.some),
        retrieve.mergeSelect(
          wrappedType,
          whereToSelection(wrappedType, where?.none),
          whereToSelection(wrappedType, where?.every),
        ),
      ),
    wrapper: ({ wrappedType }) => whereToSelectionInternal(wrappedType, where),
    otherwise: () => {
      throw new Error('Unreachable')
    },
  })
}

/**
 * Checks if selection is included in policy's selection
 */
export function isSelectionIncluded(
  policy: RetrievePolicy,
  selection: retrieve.GenericSelect | undefined,
): result.Result<null, path.Path[]> {
  const allowedPaths = selectionToPaths(policy.entity, policy.selection)
  const requestedPaths = selectionToPaths(policy.entity, selection)
  const forbiddenPaths: path.Path[] = []
  for (const requestedPath of requestedPaths) {
    if (!allowedPaths.has(requestedPath)) {
      forbiddenPaths.push(requestedPath)
    }
  }
  return forbiddenPaths.length === 0 ? result.ok(null) : result.fail(forbiddenPaths)
}

/**
 * Checks policies recursively for each relations (entity) that is included in the original retrieve.
 */
function checkForRelations({ outputType, policies, capabilities, ...input }: Required<PolicyCheckInput>): Result {
  const concreteType = model.concretise(model.unwrapAndConcretize(outputType))
  if (!input.retrieve.select || (concreteType.kind !== model.Kind.Object && concreteType.kind !== model.Kind.Entity)) {
    return result.ok(input.retrieve)
  }
  const newRetrieve = { ...input.retrieve, select: { ...input.retrieve.select } }
  for (const [key, value] of Object.entries(input.retrieve.select).filter((v) => v[1])) {
    const unwrappedField = model.unwrapAndConcretize(concreteType.fields[key])
    if (unwrappedField.kind === model.Kind.Entity) {
      //TODO: inject input.retrieve.where[key] into relation retrieve
      //Also if the where is contained in AND
      const result = checkPoliciesInternal({
        outputType: concreteType.fields[key],
        capabilities: retrieve.allCapabilities,
        policies,
        retrieve:
          value === true
            ? { select: buildSelectForEntity(unwrappedField.fields) }
            : (value as retrieve.GenericRetrieve),
        path: path.appendField(input.path, key),
      })
      if (result.isFailure) {
        return result
      }
      newRetrieve.select[key] = result.value
    }
  }
  return result.ok(newRetrieve)
}

function buildSelectForEntity(fields: model.Types): retrieve.GenericSelect {
  //pain point: what if entity inside of object?
  return flatMapObject(fields, (name, type) => (model.isEntity(model.unwrapAndConcretize(type)) ? [] : [[name, true]]))
}

/**
 * Gets a set of path that match the sum of selected fields.
 * It does not follow sub-entities
 */
export function selectionToPaths(
  type: model.Type,
  selection: retrieve.GenericSelect | undefined | boolean,
  prefix: path.Path = path.root,
): ReadonlySet<path.Path> {
  const emptySet = new Set<path.Path>()
  if (selection == null) {
    return emptySet
  }
  return model.match(type, {
    scalar: () => new Set([prefix]),
    wrapper: ({ wrappedType }) => selectionToPaths(wrappedType, selection, prefix),
    record: ({ fields, kind }) => {
      if (kind === model.Kind.Entity && prefix !== '$') {
        return emptySet
      }
      const paths = Object.entries(fields)
        .map(([fieldName, fieldType]) => {
          const subSelection =
            typeof selection === 'object' && selection[fieldName]
              ? selection[fieldName]
              : selection === true
                ? true
                : null
          if (subSelection === true) {
            return selectionToPaths(fieldType, subSelection as any, path.appendField(prefix, fieldName))
          } else if (subSelection) {
            return selectionToPaths(fieldType, subSelection.select, path.appendField(prefix, fieldName))
          } else {
            return emptySet
          }
        })
        .flatMap((set) => [...set.values()])
      if (kind === model.Kind.Entity) {
        return new Set([prefix, ...paths])
      } else {
        return new Set(paths)
      }
    },
    union: () => emptySet,
  })
}

/**
 * Checks if policy's where is included in where filter in order to check if the operation is inside the restriction
 * where <= policy.restriction (the where clausole will filter more or equals "value domain" than policy.restriction?)
 */
export function isWithinRestriction(policy: RetrievePolicy, where: retrieve.GenericWhere | undefined): boolean {
  if (!policy.restriction || Object.keys(policy.restriction).length === 0) {
    return true
  }
  if (!where) {
    return false
  }

  const [restrictionField] = Object.keys(policy.restriction)
  const restrictionFilter = policy.restriction[restrictionField]
  const restrictionValues =
    'in' in restrictionFilter ? restrictionFilter.in : 'equals' in restrictionFilter ? [restrictionFilter.equals] : []

  if (!isValuesIncluded(restrictionField, restrictionValues, where)) {
    return false
  }
  if (where.OR) {
    if (
      !where.OR.every((where: retrieve.GenericWhere) => isValuesIncluded(restrictionField, restrictionValues, where))
    ) {
      return false
    }
  }
  return true
}

function isValuesIncluded(restrictionField: string, restrictionValues: any[], where: retrieve.GenericWhere): boolean {
  if (restrictionField in where) {
    const filterBy =
      'equals' in where[restrictionField]
        ? [where[restrictionField].equals]
        : 'in' in where[restrictionField]
          ? (where[restrictionField].in as any[])
          : false
    if (filterBy === false) {
      return false
    }
    if (restrictionValues.some((v) => filterBy.find((f) => isDeepStrictEqual(f, v)))) {
      return true
    } else {
      if (where.AND) {
        if (
          where.AND.some((where: retrieve.GenericWhere) => isValuesIncluded(restrictionField, restrictionValues, where))
        ) {
          return true
        }
      }
      return false
    }
  }
  return false
}

/**
 * Gets a policies builder for the given entity.
 */
export function on<T extends model.Type>(entity: T): PoliciesBuilder<T> {
  return new PoliciesBuilder(entity, new Map(), new Map()).on(entity)
}

class PoliciesBuilder<T extends model.Type> implements Policies {
  private readonly entity: T
  private _retrievePolicies: Map<model.Type, RetrievePolicy[]>
  private _mapperPolicies: Map<model.Type, MapperPolicy[]>

  constructor(
    entity: T,
    retrievePolicies: Map<model.Type, RetrievePolicy[]>,
    mapperPolicies: Map<model.Type, MapperPolicy[]>,
  ) {
    this._retrievePolicies = retrievePolicies
    this._mapperPolicies = mapperPolicies
    this.entity = entity
  }

  get retrievePolicies(): ReadonlyMap<model.Type, RetrievePolicy[]> {
    return this._retrievePolicies
  }
  get mapperPolicies(): ReadonlyMap<model.Type, MapperPolicy[]> {
    return this._mapperPolicies
  }

  /**
   * Create a new security {@link RetrievePolicy} for this entity.
   */
  allows(policy: Omit<RetrievePolicy<T>, 'entity'>): this {
    if (policy.restriction) {
      const keys = Object.keys(policy.restriction)
      const fields = (model.concretise(this.entity) as model.EntityType<any, model.Types>).fields
      if (
        keys.length !== 1 ||
        !(keys[0] in fields) ||
        model.isArray(fields[keys[0]]) ||
        !model.isScalar(model.unwrapAndConcretize(fields[keys[0]]))
      ) {
        throw new Error('Currently on policy restriction it is supported only on (non array) scalar field.')
      }
    }
    const policies = this._retrievePolicies.get(this.entity) ?? []
    policies.push({ ...policy, entity: this.entity })
    this._retrievePolicies.set(this.entity, policies)
    return this
  }

  /**
   * Create a new security {@link MapperPolicy} for this entity.
   */
  map(mapper: (entity: model.Infer<model.PartialDeep<T>>) => model.Infer<model.PartialDeep<T>>): this {
    const policies = this._mapperPolicies.get(this.entity) ?? []
    policies.push({ mapper: mapper as any })
    this._mapperPolicies.set(this.entity, policies)
    return this
  }

  /**
   * Gets a policies builder for the given entity.
   */
  on<T extends model.Type>(entity: T): PoliciesBuilder<T> {
    const typeKind = model.concretise(entity).kind
    if (typeKind !== model.Kind.Entity) {
      throw new Error(`Policies could be defined only on entity types. Got ${typeKind}`)
    }
    return new PoliciesBuilder(entity, this._retrievePolicies, this._mapperPolicies)
  }
}
