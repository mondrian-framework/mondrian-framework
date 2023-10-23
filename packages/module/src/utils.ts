import { types } from '@mondrian-framework/model'
import crypto from 'crypto'

/**
 * Generates a random operation id.
 * It's a UUID v4.
 *
 * @returns new random operation id.
 */
export function randomOperationId() {
  return crypto.randomUUID()
}

export function uniqueTypes(from: types.Type): Set<types.Type> {
  return gatherUniqueTypes(new Set(), from)
}

export function allUniqueTypes(from: types.Type[]): Set<types.Type> {
  return from.reduce(gatherUniqueTypes, new Set())
}

function gatherUniqueTypes(inspectedTypes: Set<types.Type>, type: types.Type): Set<types.Type> {
  if (inspectedTypes.has(type)) {
    return inspectedTypes
  } else {
    inspectedTypes.add(type)
  }
  return types.match(type, {
    scalar: () => inspectedTypes,
    wrapper: ({ wrappedType }) => gatherUniqueTypes(inspectedTypes, wrappedType),
    union: ({ variants }) => Object.values(variants).reduce(gatherUniqueTypes, inspectedTypes),
    object: ({ fields }) => Object.values(fields).reduce(gatherUniqueTypes, inspectedTypes),
    entity: ({ fields }) => Object.values(fields).reduce(gatherUniqueTypes, inspectedTypes),
  })
}
