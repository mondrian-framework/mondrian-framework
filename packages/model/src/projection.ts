import { projection, result, types } from './index'
import { PartialDeep, assertNever } from './utils'

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
export type FromType<T extends types.Type> = true | (
  [T] extends [types.NumberType] ? never
: [T] extends [types.StringType] ? never
: [T] extends [types.BooleanType] ? never
: [T] extends [types.EnumType<any>] ? never
: [T] extends [types.LiteralType<any>] ? never
: [T] extends [types.CustomType<any, any, any>] ? never
: [T] extends [types.ArrayType<any, infer T1>] ? projection.FromType<T1>
: [T] extends [types.OptionalType<infer T1>] ? projection.FromType<T1>
: [T] extends [types.NullableType<infer T1>] ? projection.FromType<T1>
: [T] extends [types.ReferenceType<infer T1>] ? projection.FromType<T1>
: [T] extends [(() => infer T1 extends types.Type)] ? projection.FromType<T1>
: [T] extends [types.UnionType<infer Ts>] ? { readonly [Key in keyof Ts]: projection.FromType<Ts[Key]> }
: [T] extends [types.ObjectType<any, infer Ts>] ? { readonly [Key in keyof Ts]?: projection.FromType<Ts[Key]> }
: Projection)

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

// TODO: add doc and instead of types.Infer it should be InferPartialDeep! For now this is just a mock
//       in order not to stop development of other modules
// TODO: this should return a result with the missing fields in the error case
// tells if value is valid (meaning that it only has the fields allowed by the actual projection)
export function respectsProjection<T extends types.Type>(
  type: T,
  projection: projection.FromType<T>,
  value: PartialDeep<types.Infer<T>>,
): result.Result<true, undefined> {
  const concreteType = types.concretise(type)
  const kind = concreteType.kind
  if (kind === "boolean" || kind === "enum" || kind === "literal" || kind === "number" || kind === "string" || kind === "custom") {
    // The projection for these types is never so it's always right
    return result.ok(true)
  } else if (kind === "reference") {
    return respectsProjection(concreteType.wrappedType, projection, value)
  } else if (kind === "nullable") {
    return value === null ? result.ok(true) : respectsProjection(concreteType.wrappedType, projection, value)
  } else if (kind === "optional") {
    return value === undefined ? result.ok(true) : respectsProjection(concreteType.wrappedType, projection, value)
  } else if (kind === "union") {
    throw "a"
  } else if (kind === "object") {
    throw "a"
  } else if (kind === "array") {
    throw "a"
  } else {
    assertNever(kind, "a")
  }
}

/*







  TODO: this code is either useless or should be moved elsewhere, if we want to keep the 
        transformation from mondrian type to mondrian type of its projection it should be in another module.







 */
///**
// * A record of {@link Projection `Projection`s}.
// */
//type Projections = Record<string, types.OptionalType<Projection>>

///**
// * Given a Mondrian {@link Type type}, returns the Mondrian type describing its {@link Projection projection}.
// * You can read {@link here TODO:} to learn more about what projections are and how they can be used.
// *
// * @example ```ts
// *          const model = object({ field1: number, field2: string })
// *          type Projection = InferProjection<typeof model>
// *          Infer<Projection>
// *          // -> true | { field1?: true, field2?: true }
// *          ```
// */
// prettier-ignore
//export type FromType<T extends types.Type>
//  = [T] extends [types.NumberType] ? types.LiteralType<true>
//  : [T] extends [types.StringType] ? types.LiteralType<true>
//  : [T] extends [types.BooleanType] ? types.LiteralType<true>
//  : [T] extends [types.EnumType<infer _>] ? types.LiteralType<true>
//  : [T] extends [types.LiteralType<infer _>] ? types.LiteralType<true>
//  : [T] extends [types.CustomType<infer _Name, infer _Options, infer _InferredAs>] ? types.LiteralType<true>
//  : [T] extends [types.ArrayType<infer _, infer T1>] ? projection.FromType<T1>
//  : [T] extends [types.OptionalType<infer T1>] ? projection.FromType<T1>
//  : [T] extends [types.NullableType<infer T1>] ? projection.FromType<T1>
//  : [T] extends [types.ReferenceType<infer T1>] ? projection.FromType<T1>
//  : [T] extends [(() => infer T1 extends types.Type)] ? projection.FromType<T1>
//  : [T] extends [types.UnionType<infer Ts>] ? types.UnionType<{
//      all: types.LiteralType<true>,
//      partial: types.ObjectType<"immutable", { [Key in keyof Ts]: types.OptionalType<projection.FromType<Ts[Key]>> }>
//    }>
//  : [T] extends [types.ObjectType<infer _, infer Ts>] ? types.UnionType<{
//      all: types.LiteralType<true>,
//      partial: types.ObjectType<"immutable", { [Key in keyof Ts]: types.OptionalType<projection.FromType<Ts[Key]>> }>
//    }>
//  : never

///**
// * @param type the type whose projection model is returned
// * @returns the Mondrian model describing the type of valid projections for the given type
// * @example ```ts
// *          const model = object({ field1: number, field2: string })
// *          projectionFromType(model)
// *          // -> union({
// *          //   all: literal(true)
// *          //   partial: object({
// *          //     field1: literal(true).optional()
// *          //     field2: literal(true).optional()
// *          //   })
// *          // })
// *          ```
// */
//export function fromType<T extends types.Type>(type: T): projection.FromType<T> {
//  const actualType = types.concretise(type)
//  switch (actualType.kind) {
//    case 'boolean':
//    case 'custom':
//    case 'literal':
//    case 'string':
//    case 'enum':
//    case 'number':
//      return types.literal(true) as projection.FromType<T>
//    case 'array':
//    case 'nullable':
//    case 'optional':
//    case 'reference':
//      return projection.fromType(actualType.wrappedType) as projection.FromType<T>
//    case 'object':
//      return projectTypesOrLiteralTrue(actualType.types) as projection.FromType<T>
//    case 'union':
//      return projectTypesOrLiteralTrue(actualType.variants) as projection.FromType<T>
//  }
//}

///**
// * Given a record of types, returns a projection type that is either the literal `true` or an object
// * with the projections of the given `types`.
// */
//function projectTypesOrLiteralTrue(ts: types.Types): Projection {
//  const projectedTypes = filterMapObject(ts, (_, fieldType: any) => projection.fromType(fieldType).optional())
//  return types.union({ all: types.literal(true), partial: types.object(projectedTypes) })
//}

///**
// * TODO: add doc
// */
// prettier-ignore
//export type ProjectedType<T extends types.Type, P extends projection.Infer<T>>
//  = [P] extends [true] ? T
//  // If P is an object but we have primitive types we cannot perform the projection
//  : [T] extends [types.NumberType] ? never
//  : [T] extends [types.StringType] ? never
//  : [T] extends [types.BooleanType] ? never
//  : [T] extends [types.LiteralType<infer _L>] ? never
//  : [T] extends [types.EnumType<infer _Vs>] ? never
//  : [T] extends [types.CustomType<infer _Name, infer _Options, infer _InferredAs>] ? never
//  // If P is an object and we have a wrapper type we perform the projection on the inner type
//  : [T] extends [types.ArrayType<infer M, infer T1>] ? [P] extends [projection.Infer<T1>]
//      ? types.ArrayType<M, ProjectedType<T1, P>> : never
//  : [T] extends [types.OptionalType<infer T1>] ? [P] extends [projection.Infer<T1>]
//      ? types.OptionalType<ProjectedType<T1, P>> : never
//  : [T] extends [types.NullableType<infer T1>] ? [P] extends [projection.Infer<T1>]
//      ? types.NullableType<ProjectedType<T1, P>> : never
//  : [T] extends [(() => infer T1 extends types.Type)] ? [P] extends [projection.Infer<T1>]
//      ? ProjectedType<T1, P> : never
//  : [T] extends [types.ReferenceType<infer T1>] ? [P] extends [projection.Infer<T1>]
//      ? ProjectedType<T1, P> : never
//  // If P is an object and we have an object-like type we perform the projection picking the selected fields
//  : [T] extends [types.UnionType<infer Ts>] ? [keyof P] extends [keyof Ts]
//    ? types.UnionType<{ [K in keyof P]: P extends Record<K, projection.Infer<Ts[K]>> ? ProjectedType<Ts[K], P[K]> : never }> : never
//  : [T] extends [types.ObjectType<infer _, infer Ts>] ? [keyof P] extends [keyof Ts]
//    ? types.ObjectType<"immutable", { [K in keyof P]: P extends Record<K, projection.Infer<Ts[K]>> ? ProjectedType<Ts[K], P[K]> : never }> : never
//  : never

///**
// * TODO: add doc
// */
//export function projectedType<T extends types.Type, P extends projection.Infer<T>>(
//  type: T,
//  projection: P,
//): ProjectedType<T, P> {
//  return unsafeProjectedType(type, projection)
//}
//
//function unsafeProjectedType(type: any, projection: any): any {
//  if (projection === true) {
//    return type
//  }
//
//  const concreteType = types.concretise(type)
//  switch (concreteType.kind) {
//    case 'number':
//    case 'string':
//    case 'boolean':
//    case 'literal':
//    case 'enum':
//    case 'custom':
//      failWithInternalError(
//        'It appears that `projectedType` was called with a simple type and a projection different from `true`. This should not be allowed by the type system and could be an internal error',
//      )
//    case 'array':
//      return unsafeProjectedType(concreteType.wrappedType, projection).array()
//    case 'nullable':
//      return unsafeProjectedType(concreteType.wrappedType, projection).nullable()
//    case 'optional':
//      return unsafeProjectedType(concreteType.wrappedType, projection).optional()
//    case 'reference':
//      return unsafeProjectedType(concreteType.wrappedType, projection)
//    case 'object':
//      return types.object(unsafeProjectFields(concreteType.types, projection))
//    case 'union':
//      return types.union(unsafeProjectFields(concreteType.variants, projection))
//  }
//}
//
//function unsafeProjectFields(types: types.Types, projection: any): Record<string, any> {
//  return filterMapObject(projection, (fieldName, subProjection) => unsafeProjectedType(types[fieldName], subProjection))
//}

/*
export function getProjectedType(type: LazyType, projection: GenericProjection | undefined): LazyType {
  if (projection === undefined || projection === true) {
    return ignoreRelations(type)
  }
  if (typeof type === 'function') {
    return () => lazyToType(getProjectedType(lazyToType(type), projection))
  }
  const t = lazyToType(type)
  if (
    t.kind === 'boolean' ||
    t.kind === 'string' ||
    t.kind === 'number' ||
    t.kind === 'enum' ||
    t.kind === 'custom' ||
    t.kind === 'literal'
  ) {
    return type
  }
  if (t.kind === 'array-decorator') {
    return array(getProjectedType(t.type, projection))
  }
  if (t.kind === 'optional-decorator') {
    return optional(getProjectedType(t.type, projection))
  }
  if (t.kind === 'nullable-decorator') {
    return nullable(getProjectedType(t.type, projection))
  }
  if (t.kind === 'default-decorator') {
    return getProjectedType(t.type, projection)
  }
  if (t.kind === 'relation-decorator') {
    return getProjectedType(t.type, projection)
  }
  if (t.kind === 'union-operator') {
    return union(
      Object.fromEntries(
        Object.entries(projection).map(([k, v]) => {
          return [k, getProjectedType(t.types[k], v)]
        }),
      ),
    )
  }
  if (t.kind === 'object') {
    return object(
      Object.fromEntries(
        Object.entries(projection).map(([k, v]) => {
          return [k, getProjectedType(t.type[k], v)]
        }),
      ),
    )
  }
  assertNever(t)
}

function ignoreRelations(type: LazyType): LazyType {
  if (typeof type === 'function') {
    return () => lazyToType(ignoreRelations(lazyToType(type)))
  }
  const t = lazyToType(type)
  if (
    t.kind === 'boolean' ||
    t.kind === 'string' ||
    t.kind === 'number' ||
    t.kind === 'enum' ||
    t.kind === 'custom' ||
    t.kind === 'literal'
  ) {
    return type
  }
  if (t.kind === 'array-decorator') {
    return array(ignoreRelations(t.type))
  }
  if (t.kind === 'optional-decorator') {
    return optional(ignoreRelations(t.type))
  }
  if (t.kind === 'nullable-decorator') {
    return nullable(ignoreRelations(t.type))
  }
  if (t.kind === 'default-decorator') {
    return ignoreRelations(t.type)
  }
  if (t.kind === 'relation-decorator') {
    return optional(ignoreRelations(t.type))
  }
  if (t.kind === 'union-operator') {
    return union(Object.fromEntries(Object.entries(t.types).map(([k, t]) => [k, ignoreRelations(t)])))
  }
  if (t.kind === 'object') {
    return object(
      Object.fromEntries(
        Object.entries(t.type).map(([k, lt]) => {
          return [k, ignoreRelations(lt)]
        }),
      ),
      t.opts,
    )
  }
  assertNever(t)
}

export type MergeGenericProjection<T1 extends GenericProjection, T2 extends GenericProjection> = [T1] extends [true]
  ? T1
  : [T2] extends [true]
  ? T2
  : {
      [K in keyof T1 | keyof T2]: [T1] extends [Record<K, GenericProjection>]
        ? [T2] extends [Record<K, GenericProjection>]
          ? MergeGenericProjection<T1[K], T2[K]>
          : T1[K]
        : [T2] extends [Record<K, GenericProjection>]
        ? T2[K]
        : never
    }

export function mergeProjections<const P1 extends GenericProjection, const P2 extends GenericProjection>(
  p1: P1,
  p2: P2,
): MergeGenericProjection<P1, P2> {
  if (p1 === true || p2 === true) return true as MergeGenericProjection<P1, P2>
  if (p1 === null || p1 === undefined) return p2 as MergeGenericProjection<P1, P2>
  if (p2 === null || p2 === undefined) return p1 as MergeGenericProjection<P1, P2>
  const p1k = Object.keys(p1)
  const p2k = Object.keys(p2)
  const keySet = new Set([...p1k, ...p2k])
  const res: Record<string, GenericProjection> = {}
  for (const key of keySet.values()) {
    res[key] = mergeProjections(p1[key] as GenericProjection, p2[key] as GenericProjection)
  }
  return res as MergeGenericProjection<P1, P2>
}

const a = true
const b = { field1: { sub1: true }, field3: true } as const
const c = mergeProjections(a, b)

export function getRequiredProjection(type: LazyType, projection: GenericProjection): GenericProjection | null {
  if (projection === true) {
    return null
  }
  const t = lazyToType(type)
  if (
    t.kind === 'boolean' ||
    t.kind === 'string' ||
    t.kind === 'number' ||
    t.kind === 'enum' ||
    t.kind === 'custom' ||
    t.kind === 'literal'
  ) {
    return null
  }
  if (
    t.kind === 'array-decorator' ||
    t.kind === 'optional-decorator' ||
    t.kind === 'nullable-decorator' ||
    t.kind === 'default-decorator' ||
    t.kind === 'relation-decorator'
  ) {
    return getRequiredProjection(t.type, projection)
  }
  if (t.kind === 'object') {
    const p = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, type]) => {
        const subF = projection[k]
        if (!subF) {
          return []
        }
        const subP = getRequiredProjection(type, subF)
        return subP != null ? [[k, subP]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  if (t.kind === 'union-operator') {
    const p = Object.fromEntries(
      Object.entries(t.types).flatMap(([k, type]) => {
        const subF = projection[k]
        if (!subF && !t.opts?.requiredProjection) {
          return []
        }
        const subP = subF ? getRequiredProjection(type, subF) : null
        const reqP =
          t.opts?.requiredProjection && t.opts.requiredProjection[k]
            ? (t.opts.requiredProjection[k] as GenericProjection)
            : null
        const res = subP && reqP ? mergeProjections(reqP, subP) : reqP
        return res != null ? [[k, res]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  assertNever(t)
}
*/
