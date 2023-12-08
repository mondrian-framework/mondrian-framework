import { retrieve } from '.'
import { model, path, result } from '@mondrian-framework/model'
import { flatMapObject, isArray } from '@mondrian-framework/utils'
import { isDeepStrictEqual } from 'util'

export type Policy<T extends model.Type = model.Type> = {
  readonly entity: T
  readonly selection: true | Exclude<retrieve.FromType<T, { select: true }>['select'], null | undefined>
  readonly restriction?:
    | (retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never })
    | null
  readonly filter?: retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never }
}

export type Result = result.Result<retrieve.GenericRetrieve | undefined, PolicyViolation>

export const PolicyViolation = () =>
  model.union({
    noApplicablePolicies: model.object({
      reason: model.literal('NO_APPLICABLE_POLICIES'),
      path: model.string(),
      allowedSelections: model.json().array(),
      otherPolicies: model.object({ when: model.json(), selection: model.json() }).array(),
    }),
    forbiddenWhereClausole: model.object({
      reason: model.enumeration(['FORBIDDEN_WHERE_CLAUSOLE', 'FORBIDDEN_ORDERBY_CLAUSOLE']),
      path: model.string(),
      forbiddenField: model.string(),
    }),
  })

export type PolicyViolation = model.Infer<typeof PolicyViolation>

export type PolicyCheckInput = {
  readonly outputType: model.Type
  readonly policies: readonly Policy[]
  readonly retrieve: retrieve.GenericRetrieve | undefined
  readonly capabilities: retrieve.Capabilities | undefined
  readonly path: path.Path
}

export function checkPolicies({ outputType, policies, retrieve, capabilities, path }: PolicyCheckInput): Result {
  if (!capabilities || !capabilities.select) {
    return result.ok(retrieve)
  }

  const appliedPolicies: Policy[] = []
  const potentiallyPolicies: Policy[] = []
  const notSatisfiedPolicies: Policy[] = []
  for (const p of policies.filter((p) => model.areEqual(p.entity, model.unwrap(outputType)))) {
    if (!isWithinRestriction(p, retrieve?.where)) {
      notSatisfiedPolicies.push(p)
    } else if (!isSelectionIncluded(p, retrieve?.select)) {
      potentiallyPolicies.push(p)
    } else {
      appliedPolicies.push(p)
    }
  }

  if (appliedPolicies.length === 0) {
    return result.fail({
      reason: 'NO_APPLICABLE_POLICIES',
      path,
      allowedSelections: potentiallyPolicies.map((p) => p.selection),
      otherPolicies: notSatisfiedPolicies.flatMap((p) =>
        p.restriction ? [{ when: p.restriction, selection: p.selection }] : [],
      ),
    })
  }

  const whereResult = isWhereAllowed({ appliedPolicies, retrieve, path })
  if (whereResult.isFailure) {
    return whereResult
  }
  const orderByResult = isOrderByAllowed({ appliedPolicies, retrieve, path })
  if (orderByResult.isFailure) {
    return orderByResult
  }

  const filters = { OR: appliedPolicies.flatMap((p) => (p.filter ? [p.filter] : [])) }
  if (filters.OR.length > 0 && !capabilities.where) {
    const typeName = model.concretise(outputType).options?.name
    throw new Error(
      `You are trying to use a policy with filter on a function without where capability. Output type: ${typeName}`,
    )
  }
  const newRetrieve =
    filters.OR.length === 0
      ? retrieve
      : { ...retrieve, where: retrieve?.where ? { AND: [retrieve.where, filters] } : filters }

  return checkForRelations({ outputType, policies, retrieve: newRetrieve, capabilities, path })
}

/**
 * Checks if selection is included in policy's selection
 */
export function isSelectionIncluded(policy: Policy, selection: retrieve.GenericSelect | undefined): boolean {
  if (policy.selection === true) {
    return true
  }
  if (!selection) {
    return false
  }
  const concreteType = model.concretise(policy.entity)
  if (concreteType.kind !== model.Kind.Object && concreteType.kind !== model.Kind.Entity) {
    return true
  }

  //TODO: finish this logic
  for (const key of Object.entries(selection)
    .filter((v) => v[1])
    .map((v) => v[0])) {
    const unwrappedField = model.unwrap(concreteType.fields[key])
    if (model.isEntity(unwrappedField)) {
      continue
    }
    if (!policy.selection[key]) {
      return false
    }
  }

  return true
}

/**
 * Checks for relations
 */
export function checkForRelations({ outputType, policies, capabilities, ...input }: PolicyCheckInput): Result {
  if (!input.retrieve?.select) {
    return result.ok(input.retrieve)
  }
  const concreteType = model.concretise(model.unwrap(outputType))
  if (concreteType.kind !== model.Kind.Object && concreteType.kind !== model.Kind.Entity) {
    return result.ok(input.retrieve)
  }
  const newRetrieve = { ...input.retrieve, select: { ...input.retrieve.select } }
  for (const [key, value] of Object.entries(input.retrieve.select).filter((v) => v[1])) {
    const unwrappedField = model.unwrap(concreteType.fields[key])
    if (model.isEntity(unwrappedField)) {
      const result = checkPolicies({
        outputType: concreteType.fields[key],
        capabilities: retrieve.allCapabilities,
        policies,
        retrieve:
          value === true ? { select: buildSelectForEntity(concreteType.fields) } : (value as retrieve.GenericRetrieve),
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
  return flatMapObject(fields, (name, type) => (model.isEntity(model.unwrap(type)) ? [] : [[name, true]]))
}

/**
 * Checks if policy's where is included in where filter in order to check if the operation is inside the domain
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

export function isWhereAllowed({
  appliedPolicies,
  retrieve,
  path,
}: {
  appliedPolicies: Policy[]
  retrieve: retrieve.GenericRetrieve | undefined
  path: path.Path
}): result.Result<null, PolicyViolation> {
  if (!retrieve?.where) {
    return result.ok(null)
  }
  return isWhereAllowedInternal({ appliedPolicies, where: retrieve.where }).mapError((forbiddenField) => ({
    reason: 'FORBIDDEN_WHERE_CLAUSOLE',
    path,
    forbiddenField,
  }))
}
function isWhereAllowedInternal({
  appliedPolicies,
  where,
}: {
  appliedPolicies: Policy[]
  where: retrieve.GenericWhere
}): result.Result<null, string> {
  const internalWhere = { ...where }
  const logical = [
    ...(isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
    ...(isArray(where.OR) ? where.OR : where.OR ? [where.OR] : []),
    ...(isArray(where.NOT) ? where.NOT : where.NOT ? [where.NOT] : []),
  ]
  for (const subWhere of logical) {
    const subResult = isWhereAllowedInternal({ appliedPolicies, where: subWhere })
    if (subResult.isFailure) {
      return subResult
    }
  }
  delete internalWhere.AND
  delete internalWhere.OR
  delete internalWhere.NOT

  for (const [field] of Object.entries(internalWhere)) {
    if (!canAccessField(appliedPolicies, field)) {
      return result.fail(field)
    }
  }

  return result.ok(null)
}

//TODO: finish this logic implementation
function canAccessField(appliedPolicies: Policy[], field: string): boolean {
  if (appliedPolicies.some((p) => p.selection === true)) {
    return true
  }
  if (appliedPolicies.some((p) => p.selection !== true && p.selection[field] === true)) {
    return true
  }
  return false
}

export function isOrderByAllowed({
  appliedPolicies,
  retrieve,
  path,
}: {
  appliedPolicies: Policy[]
  retrieve: retrieve.GenericRetrieve | undefined
  path: path.Path
}): result.Result<null, PolicyViolation> {
  if (!retrieve?.orderBy) {
    return result.ok(null)
  }
  for (const order of isArray(retrieve.orderBy) ? retrieve.orderBy : [retrieve.orderBy]) {
    for (const [field] of Object.entries(order)) {
      if (!canAccessField(appliedPolicies, field)) {
        return result.fail({
          reason: 'FORBIDDEN_ORDERBY_CLAUSOLE',
          path,
          forbiddenField: field,
        })
      }
    }
  }
  return result.ok(null)
}

export function on<T extends model.Type>(entity: T): Builder<T> {
  return new Builder(entity, [])
}

class Builder<T extends model.Type> {
  private readonly entity: T
  private readonly _policies: Policy[]
  constructor(entity: T, policies: Policy[]) {
    this._policies = policies
    this.entity = entity
  }

  read(policy: Omit<Policy<T>, 'entity'>): this {
    this._policies.push({ ...policy, entity: this.entity })
    return this
  }

  allows(policies: Omit<Policy<T>, 'entity'>[] | Omit<Policy<T>, 'entity'>): this {
    if (isArray(policies)) {
      this._policies.push(...policies.map((p) => ({ ...p, entity: this.entity })))
    } else {
      this._policies.push({ ...policies, entity: this.entity })
    }
    return this
  }

  get policies(): readonly Policy[] {
    return [...this._policies]
  }

  on<T extends model.Type>(entity: T): Builder<T> {
    return new Builder(entity, this._policies)
  }
}
