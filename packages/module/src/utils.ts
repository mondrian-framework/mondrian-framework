import { model } from '@mondrian-framework/model'
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

/**
 * Return a set with all the unique types referenced by the given type.
 *
 * @example For example if the given type is an object the resulting set will
 *          contain not only the object type itself, but also the types of its
 *          fields
 */
export function uniqueTypes(from: model.Type): Set<model.Type> {
  return gatherUniqueTypes(new Set(), from)
}

/**
 * Retruns a set with all the unique types referenced by the given list of types.
 */
export function allUniqueTypes(from: model.Type[]): Set<model.Type> {
  return from.reduce(gatherUniqueTypes, new Set())
}

// Returns a set of unique types referenced by the given type. The first argument
// is a set that contains the types that have already been inspected and is updated
// _in place_!
function gatherUniqueTypes(inspectedTypes: Set<model.Type>, type: model.Type): Set<model.Type> {
  if (inspectedTypes.has(type)) {
    return inspectedTypes
  } else {
    inspectedTypes.add(type)
  }
  return model.match(type, {
    scalar: () => inspectedTypes,
    wrapper: ({ wrappedType }) => gatherUniqueTypes(inspectedTypes, wrappedType),
    union: ({ variants }) => Object.values(variants).reduce(gatherUniqueTypes, inspectedTypes),
    object: ({ fields }) => Object.values(fields).reduce(gatherUniqueTypes, inspectedTypes),
    entity: ({ fields }) => Object.values(fields).reduce(gatherUniqueTypes, inspectedTypes),
  })
}
