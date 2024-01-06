import { functions } from '.'
import { ErrorType } from './function'
import { decoding, model, result, validation } from '@mondrian-framework/model'
import { mapObject } from '@mondrian-framework/utils'

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
  }

  inspectedTypes.add(type)
  return model.match(type, {
    scalar: () => inspectedTypes,
    wrapper: ({ wrappedType }) => gatherUniqueTypes(inspectedTypes, wrappedType),
    union: ({ variants }) => Object.values(variants).reduce(gatherUniqueTypes, inspectedTypes),
    object: ({ fields }) => Object.values(fields).reduce(gatherUniqueTypes, inspectedTypes),
    entity: ({ fields }) => Object.values(fields).reduce(gatherUniqueTypes, inspectedTypes),
  })
}

/**
 * Decodes the value with the expected failure result of a function that support typed errors.
 */
export function decodeFunctionFailure(
  values: unknown,
  errors: Exclude<functions.ErrorType, undefined>,
  options?: decoding.Options,
): result.Result<unknown, validation.Error[] | decoding.Error[]> {
  const errorType = model.object(mapObject(errors, (_, errorType) => model.optional(errorType))) as model.ObjectType<
    model.Mutability.Immutable,
    model.Types
  >
  const errorDecodeResult = errorType.decode(values as never, options)
  if (errorDecodeResult.isFailure) {
    return errorDecodeResult
  }
  // here an empty object {} would pass the decoding process
  // this is wrong because the result.fail({ }) requires at least one property of the errors map
  // so we add another step that checks for empty objects.
  // in case of {} we return a decoding error as if the decoding process failed
  if (Object.keys(values as object).length === 0) {
    return decoding.fail(`An object with at least one of this field: ${Object.keys(errors).join(', ')}`, {})
  }
  return errorDecodeResult
}

//prettier-ignore
export type MergeErrors<E1 extends ErrorType, E2 extends ErrorType> 
  = [E1] extends [undefined] ? E2
  : [E2] extends [undefined] ? E1
  : { [K in (keyof E1 | keyof E2)]: K extends keyof E1 ? E1[K] : K extends keyof E2 ? E2[K] : never } extends (infer E extends ErrorType) ? E : never

export function mergeErrors(
  l: ErrorType | undefined,
  r: ErrorType | undefined,
  functionName: string,
): ErrorType | undefined {
  if (!l) {
    return r
  }
  if (!r) {
    return l
  }
  const errors: Record<string, model.Type> = {}
  for (const key of [...Object.keys(l), ...Object.keys(r)]) {
    if (!l[key]) {
      errors[key] = r[key]
    } else if (!r[key]) {
      errors[key] = l[key]
    } else if (model.areEqual(l[key], r[key])) {
      errors[key] = l[key]
    } else {
      throw new Error(`Duplicate error definition "${key}". Both on module and on function "${functionName ?? ''}"`)
    }
  }
  return errors
}
