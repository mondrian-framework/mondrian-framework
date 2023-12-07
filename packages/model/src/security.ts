import { model, path, result, retrieve } from '.'
import { flatMapObject } from '@mondrian-framework/utils'
import { isDeepStrictEqual } from 'util'

export type Policy<T extends model.Type = model.Type> = {
  entity: T
  selection: true | Exclude<retrieve.FromType<T, { select: true }>['select'], null | undefined>
  domain?: (retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never }) | null
  filter?: retrieve.FromType<T, { where: true }>['where'] & { AND?: never; OR?: never; NOT?: never }
}

export type Result = result.Result<retrieve.GenericRetrieve | undefined, PolicyError>

export const PolicyError = model.object({
  path: model.string(),
  allowedSelections: model.json().array(),
  otherPolicies: model.object({ domain: model.json(), selection: model.json() }).array(),
})

export type PolicyError = model.Infer<typeof PolicyError>

export type PolicyCheckInput = {
  outputType: model.Type
  policies: Policy[]
  retrieve: retrieve.GenericRetrieve | undefined
  capabilities: retrieve.Capabilities | undefined
  path: path.Path
}

export function checkPolicies({ outputType, policies, retrieve, capabilities, path }: PolicyCheckInput): Result {
  if (!capabilities || !capabilities.select) {
    return result.ok(retrieve)
  }

  const foundPolicies: Policy[] = []
  const appliedPolicies: Policy[] = []
  const potentiallyPolicies: Policy[] = []
  const notSatisfiedPolicies: Policy[] = []
  for (const p of policies) {
    if (!model.areEqual(p.entity, model.unwrap(outputType))) {
      continue
    }
    foundPolicies.push(p)
    if (!isInsideDomain(p, retrieve?.where)) {
      notSatisfiedPolicies.push(p)
      continue
    }
    if (isSelectionIncluded(p, retrieve?.select)) {
      appliedPolicies.push(p)
    } else {
      potentiallyPolicies.push(p)
    }
  }

  if (appliedPolicies.length === 0 && foundPolicies.length > 0) {
    return result.fail({
      path,
      allowedSelections: potentiallyPolicies.map((p) => p.selection),
      otherPolicies: notSatisfiedPolicies.flatMap((p) =>
        p.domain ? [{ domain: p.domain, selection: p.selection }] : [],
      ),
    })
  }

  const filters = { OR: appliedPolicies.flatMap((p) => (p.filter ? [p.filter] : [])) }
  const newRetrieve =
    filters.OR.length === 0
      ? retrieve
      : { ...retrieve, where: retrieve?.where ? { AND: [retrieve.where, filters] } : filters }

  const res = checkForRelations({ outputType, policies, retrieve: newRetrieve, capabilities, path })
  return res
}

/**
 * Checks if selection is included in policy's selection
 */
export function isSelectionIncluded(
  policy: Policy,
  selection: retrieve.GenericSelect | undefined,
): boolean {
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
export function isInsideDomain(policy: Policy, where: retrieve.GenericWhere | undefined): boolean {
  if (!policy.domain || Object.keys(policy.domain).length === 0) {
    return true
  }
  if (!where) {
    return false
  }

  for (const [key, filter] of Object.entries(policy.domain).filter((v) => v[1] !== undefined)) {
    const whereFilter = where[key]
    if (!whereFilter || !isDeepStrictEqual(whereFilter, filter)) {
      return false
    }
  }

  return true
}

export function of<T extends model.Type>(entity: T): Builder<T> {
  return new Builder(entity, [])
}

class Builder<T extends model.Type> {
  private readonly entity: T
  private readonly policies: Policy[]
  constructor(entity: T, policies: Policy[]) {
    this.policies = policies
    this.entity = entity
  }

  privateRead(policy: Required<Omit<Policy<T>, 'entity' | 'filter'>>): this {
    this.policies.push({ ...policy, entity: this.entity })
    return this
  }

  publicRead(selection: Policy<T>['selection']): this {
    this.policies.push({ selection, domain: null, entity: this.entity })
    return this
  }

  publicFilteredRead(policy: Required<Omit<Policy<T>, 'entity' | 'domain'>>): this {
    this.policies.push({ ...policy, entity: this.entity })
    return this
  }

  privateFilteredRead(policy: Required<Omit<Policy<T>, 'entity'>>): this {
    this.policies.push({ ...policy, entity: this.entity })
    return this
  }

  build(): Policy[] {
    return [...this.policies]
  }

  of<T extends model.Type>(entity: T): Builder<T> {
    return new Builder(entity, this.policies)
  }
}
