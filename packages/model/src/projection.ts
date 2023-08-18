import { decoder, path, projection, result, types } from './index'
import { always, assertNever, filterMapObject, mergeArrays, unsafeObjectToTaggedVariant } from './utils'

/**
 * This is the type of a projection: it is either the literal value `true` or an object
 * whose fields are themselves projections.
 *
 * TODO: what is a projection and what is it used for.
 *
 * @example ```ts
 *          const projection: Projection = { field1: true, field2: { inner: true } }
 *          ```
 */
export type Projection = true | { readonly [field: string]: Projection | undefined }

/**
 * Given a Mondrian {@link Type type}, returns the type describing its projection.
 * You can read {@link here TODO:} to learn more about what projections are and how they can be used.
 *
 * @example ```ts
 *          const model = types.object({ field1: number, field2: string })
 *          type P = projection.Infer<typeof model>
 *          // -> true | { field1?: true, field2?: true }
 *          ```
 */
// prettier-ignore
export type FromType<T extends types.Type> = 
  [T] extends [types.NumberType] ? true
: [T] extends [types.StringType] ? true
: [T] extends [types.BooleanType] ? true
: [T] extends [types.EnumType<any>] ? true
: [T] extends [types.LiteralType<any>] ? true
: [T] extends [types.CustomType<any, any, any>] ? true
: [T] extends [types.ArrayType<any, infer T1>] ? true | FromType<T1>
: [T] extends [types.OptionalType<infer T1>] ? true | FromType<T1>
: [T] extends [types.NullableType<infer T1>] ? true | FromType<T1>
: [T] extends [types.ReferenceType<infer T1>] ? true | FromType<T1>
: [T] extends [(() => infer T1 extends types.Type)] ? true | FromType<T1>
: [T] extends [types.UnionType<infer Ts>] ? true | { readonly [Key in keyof Ts]?: true | FromType<Ts[Key]> }
: [T] extends [types.ObjectType<any, infer Ts>] ? true | { readonly [Key in keyof Ts]?: true | FromType<Ts[Key]> }
: never

/**
 * @param projection the projection whose depth is returned
 * @returns the depth of the projection, that is the maximum nesting of the projection
 * @example ```ts
 *          projectionDepth(undefined)
 *          // -> 0
 *          ```
 * @example ```ts
 *          projectionDepth(true)
 *          // -> 0
 *          ```
 * @example ```ts
 *          projectionDepth({ field1: { inner1: true } })
 *          // -> 2
 *          ```
 */
export function depth(projection: Projection): number {
  if (projection === true) {
    return 0
  } else {
    const innerProjections = Object.values(projection)
    // TODO: this is not tail recursive and may blow up the stack
    //       to be extra safe this should be implemented with no recursion
    const depths = innerProjections.map((innerProjection) => (innerProjection ? depth(innerProjection) : 0))
    return 1 + Math.max(-1, ...depths)
  }
}

/**
 * The type of a string that can be used to select any piece of a projection.
 * @example ```ts
 *          type P = { field1: true, field2: { inner1: true } }
 *          type S = projection.Selector<P>
 *          // -> ["field1"] | ["field2"] | ["field2", "inner1"]
 *          ```
 */
export type Selector<P extends Projection> = P extends true
  ? never
  : P extends undefined
  ? never
  : P extends Record<string, Projection>
  ? {
      [FieldName in keyof P]-?: Selector<P[FieldName]> extends []
        ? [FieldName]
        : [FieldName] | [FieldName, ...Selector<P[FieldName]>]
    }[keyof P]
  : never

/**
 * Given a {@link Projection} and one of its {@link Selector selectors}, returns the type of the projection
 * corresponding to that key(s).
 *
 * @example ```ts
 *          type P = { field1: true, field2: { inner1: true } }
 *          projection.SubProjection<P, ["field1"]>
 *          // -> true
 *          projection.SubProjection<P, ["field2"]>
 *          // -> { inner1: true }
 *          projection.SubProjection<P, ["field2", "inner1"]>
 *          // -> true
 *          ```
 */
export type SubProjection<P extends Projection, S extends Selector<P>> = P extends Record<string, Projection>
  ? S extends [infer FirstField extends keyof P, ...infer Rest]
    ? Rest extends []
      ? P[FirstField] | undefined
      : Rest extends Selector<P[FirstField]>
      ? SubProjection<P[FirstField], Rest> | undefined
      : never
    : never
  : never

/**
 * @param projection the projection from which to select a subprojection
 * @param selector the selector that defines which subprojection is taken
 * @returns the subprojection corresponding to the given path
 *
 * @example ```ts
 *          const p = { field1: true, field2: { inner1: true } }
 *          projection.subProjection(p, ["field1"])
 *          // -> true
 *          projection.subProjection(p, ["field2"])
 *          // -> { inner1: true }
 *          projection.subProjection(p, ["field2", "inner1"])
 *          // -> true
 *          ```
 */
export function subProjection<P extends Projection, S extends Selector<P>>(
  projection: P,
  selector: S,
): SubProjection<P, S> {
  let selected: any = projection
  for (const fragment of selector) {
    if (selected === true || selected === undefined) {
      return selected
    } else {
      selected = selected[fragment]
    }
  }
  return selected
}

export type Error = path.WithPath<{
  missingField: string
}>

// TODO: add doc
export function respectsProjection<T extends types.Type>(
  type: T,
  projection: projection.FromType<T>,
  value: types.InferPartial<T>,
): result.Result<true, projection.Error[]> {
  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case types.Kind.Boolean:
    case types.Kind.Enum:
    case types.Kind.Literal:
    case types.Kind.Number:
    case types.Kind.String:
    case types.Kind.Custom:
      return result.ok(true)
    case types.Kind.Reference:
      return respectsProjection(concreteType.wrappedType, projection as any, value as any)
    case types.Kind.Nullable:
      return validateNullable(concreteType.wrappedType, projection, value)
    case types.Kind.Optional:
      return validateOptional(concreteType.wrappedType, projection, value)
    case types.Kind.Union:
      return validateUnion(concreteType.variants, projection, value)
    case types.Kind.Object:
      return validateObject(concreteType.fields, projection, value as Record<string, any>)
    case types.Kind.Array:
      return validateArray(concreteType.wrappedType, projection, value as any[])
    default:
      assertNever(concreteType, 'Totality check failed when checking a projection, this should have never happened')
  }
}

function validateOptional(
  type: types.Type,
  projection: Projection,
  value: any,
): result.Result<true, projection.Error[]> {
  return value === undefined ? result.ok(true) : respectsProjection(type, projection as never, value as never)
}

function validateNullable(
  type: types.Type,
  projection: Projection,
  value: any,
): result.Result<true, projection.Error[]> {
  return value === null ? result.ok(true) : respectsProjection(type, projection as never, value as never)
}

function validateUnion(
  variants: types.Types,
  projection: Projection,
  value: any,
): result.Result<true, projection.Error[]> {
  const [variantName, variantValue] = unsafeObjectToTaggedVariant(value as Record<string, any>)
  const variantProjection = subProjection(projection, [variantName] as never)
  const variantType = variants[variantName]
  const result = respectsProjection(variantType, variantProjection, variantValue as never)
  return result.mapError((errors) => path.prependVariantToAll(errors, variantName))
}

function validateObject(
  fields: types.Types,
  projection: Projection,
  object: Record<string, any>,
): result.Result<true, projection.Error[]> {
  const requiredFields = getRequiredFields(fields, projection)
  const validateField = ([fieldName, fieldType]: [string, types.Type]) =>
    validateRequiredField(fieldName, fieldType, projection, object)
  return result.tryEach(requiredFields, true, always(true), [] as projection.Error[], mergeArrays, validateField)
}

function validateRequiredField(
  fieldName: string,
  fieldType: types.Type,
  projection: Projection,
  object: Record<string, any>,
): result.Result<true, projection.Error[]> {
  const fieldValue = object[fieldName]
  if (fieldValue === undefined && !types.isOptional(fieldType)) {
    return result.fail([{ missingField: fieldName, path: path.empty() }])
  } else {
    const fieldProjection = subProjection(projection, [fieldName] as never)
    const result = respectsProjection(fieldType, fieldProjection, fieldValue as never)
    return result.mapError((errors) => path.prependFieldToAll(errors, fieldName))
  }
}

function getRequiredFields(fields: types.Types, projection: Projection): [string, types.Type][] {
  if (projection === true) {
    const dropOptionals = (_: string, fieldType: types.Type) => (types.isOptional(fieldType) ? undefined : fieldType)
    return Object.entries(filterMapObject(fields, dropOptionals))
  } else {
    return Object.entries(filterMapObject(projection, (fieldName, _) => fields[fieldName]))
  }
}

function validateArray(
  type: types.Type,
  projection: Projection,
  array: any[],
): result.Result<true, projection.Error[]> {
  const validateItem = (item: any, index: number) =>
    respectsProjection(type, projection as never, item as never).mapError((errors) =>
      path.prependIndexToAll(errors, index),
    )

  return result.tryEach(array, true, always(true), [] as projection.Error[], mergeArrays, validateItem)
}

/**
 * TODO: add docs
 * @param type
 * @param value
 * @param options
 * @returns
 */
export function decode<T extends types.Type>(
  type: T,
  value: unknown,
  options?: Partial<decoder.Options>,
): decoder.Result<FromType<T>> {
  const trueResult = (
    options?.typeCastingStrategy === 'tryCasting'
      ? decoder
          .decode(types.literal('true'), value, options)
          .map(() => true)
          .lazyOr(() => decoder.decode(types.literal(1), value, options).map(() => true))
          .lazyOr(() => decoder.decode(types.literal(true), value, options))
      : decoder.decode(types.literal(true), value, options)
  ) as decoder.Result<FromType<T>>
  if (trueResult.isOk) {
    return trueResult
  }
  const unwrapped = types.unwrap(type)
  if (unwrapped.kind === types.Kind.Object || unwrapped.kind === types.Kind.Union) {
    if (typeof value !== 'object' || value == null) {
      return decoder.fail<FromType<T>>('object', value).mapError((error) => [...trueResult.error, ...error])
    }
    const addDecodedEntry = (accumulator: [string, unknown][], [fieldName, value]: readonly [string, unknown]) => {
      accumulator.push([fieldName, value])
      return accumulator
    }
    const decodeEntry = ([fieldName, fieldType]: [string, types.Type]) =>
      decode(fieldType, (value as Record<string, unknown>)[fieldName], options)
        .map((value) => [fieldName, value] as const)
        .mapError((errors) => path.prependFieldToAll(errors, fieldName))
    const entries = Object.entries(unwrapped.kind === types.Kind.Object ? unwrapped.fields : unwrapped.variants).filter(
      ([fieldName, _]) => (value as Record<string, unknown>)[fieldName] !== undefined,
    ) as [string, types.Type][]
    const decodedEntries =
      options?.errorReportingStrategy === 'allErrors'
        ? result.tryEach(entries, [], addDecodedEntry, [] as decoder.Error[], mergeArrays, decodeEntry)
        : result.tryEachFailFast(entries, [], addDecodedEntry, decodeEntry)
    return decodedEntries.map(Object.fromEntries)
  }
  return trueResult
}
