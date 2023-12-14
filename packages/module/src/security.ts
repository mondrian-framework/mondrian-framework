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
export type Policy<T extends model.Type = model.Type> = {
  readonly entity: T
  readonly selection: true | Exclude<retrieve.FromType<T, { select: true }>['select'], null | undefined> //TODO: excluding connected entities?
  readonly restriction?:
    | (retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never })
    | null
  readonly filter?: retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never }
}

/**
 * Represent a set of {@link Policy}
 */
export type Policies = {
  readonly list: readonly Policy[]
}

/**
 * The result type for {@link checkPolicies} operation.
 */
export type Result = result.Result<retrieve.GenericRetrieve | undefined, PolicyViolation>

/**
 * The mondrian type of a PolicyViolation error.
 */
export const PolicyViolation = () =>
  model.object({
    path: model.string(),
    reasons: model
      .object({
        applicable: model.boolean(),
        policy: model.json(),
        forbiddenAccess: model.string().array().optional(),
      })
      .array(),
  })
export type PolicyViolation = model.Infer<typeof PolicyViolation>

/**
 * Information needed to perform a policy check.
 */
export type PolicyCheckInput = {
  readonly outputType: model.Type
  readonly policies: Policies
  readonly retrieve?: retrieve.GenericRetrieve
  readonly capabilities?: retrieve.Capabilities
  readonly path: path.Path
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

  const unwrapped = model.concretise(model.unwrap(outputType))
  if (unwrapped.kind !== model.Kind.Entity) {
    throw new Error('Should be an entity')
  }
  const mappedRetrieve = spreadWhereAndOrderByIntoSelection(unwrapped, retrieve)

  const appliedPolicies: Policy[] = []
  const potentiallyPolicies: { policy: Policy; forbiddenAccess: path.Path[] }[] = []
  const notSatisfiedPolicies: Policy[] = []
  const thisPolicies = policies.list.filter((p) => model.areEqual(p.entity, model.unwrap(outputType)))
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

  const unwrapped = model.unwrap(type)
  return model.match(unwrapped, {
    entity: ({ fields }) => {
      const selection: Mutable<retrieve.GenericSelect> = {}
      for (const [fieldName, fieldType] of Object.entries(fields)) {
        if (originalSelect[fieldName] && currentSelect[fieldName] && model.isEntity(model.unwrap(fieldType))) {
          selection[fieldName] = intersectRetrieveSelection(
            fieldType,
            originalSelect[fieldName] as any,
            currentSelect[fieldName] as any,
          )
        } else {
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
  const unwrapped = model.unwrap(type)
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
          if ('equals' in wherePart) {
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
  policy: Policy,
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
  const concreteType = model.concretise(model.unwrap(outputType))
  if (!input.retrieve.select || (concreteType.kind !== model.Kind.Object && concreteType.kind !== model.Kind.Entity)) {
    return result.ok(input.retrieve)
  }
  const newRetrieve = { ...input.retrieve, select: { ...input.retrieve.select } }
  for (const [key, value] of Object.entries(input.retrieve.select).filter((v) => v[1])) {
    const unwrappedField = model.unwrap(concreteType.fields[key])
    if (unwrappedField.kind === model.Kind.Entity) {
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
  //TODO: what if entity inside of object?
  return flatMapObject(fields, (name, type) => (model.isEntity(model.unwrap(type)) ? [] : [[name, true]]))
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
export function isWithinRestriction(policy: Policy, where: retrieve.GenericWhere | undefined): boolean {
  if (!policy.restriction || Object.keys(policy.restriction).length === 0) {
    return true
  }
  if (!where) {
    return false
  }

  //TODO: finish this logic
  for (const [key, filter] of Object.entries(policy.restriction).filter((v) => v[1] !== undefined)) {
    const whereFilter = where[key]
    if (!whereFilter || !isDeepStrictEqual(whereFilter, filter)) {
      return false
    }
  }

  return true
}

/**
 * Gets a policies builder for the given entity.
 */
export function on<T extends model.Type>(entity: T): PoliciesBuilder<T> {
  return new PoliciesBuilder(entity, []).on(entity)
}

class PoliciesBuilder<T extends model.Type> implements Policies {
  private readonly entity: T
  private policies: Policy[]

  constructor(entity: T, policies: Policy[]) {
    this.policies = policies
    this.entity = entity
  }

  get list(): Policy[] {
    return [...this.policies]
  }

  /**
   * Create a new security {@link Policy} for this entity.
   */
  allows(policies: Omit<Policy<T>, 'entity'>): this {
    this.policies.push({ ...policies, entity: this.entity })
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
    return new PoliciesBuilder(entity, this.policies)
  }
}
