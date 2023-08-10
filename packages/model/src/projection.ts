import { projection, types } from './index'
import { filterMapObject, failWithInternalError } from './utils'

/**
 * This is the Mondrian type describing the structure of a projection: it is either the literal value
 * `true` or a union composed of two variants: an `all` variant (which is again the literal `true`) and
 * a `partial` variant which describes a subprojection with possibly many fields; this is why it is described
 * by an `ObjectType` whose fields can themselves only be valid projections.
 */
type Projection =
  | types.LiteralType<true>
  | types.UnionType<{ all: types.LiteralType<true>; partial: types.ObjectType<'immutable', Projections> }>

/**
 * This is a quick shorthand for `types.Infer<projection.FromType<T>>`.
 * Infers the type of the projection for a given {@link types.Type type} `T`.
 */
export type Infer<T extends types.Type> = types.Infer<projection.FromType<T>>

// TODO: add doc and instead of types.Infer it should be InferPartialDeep! For now this is just a mock
//       in order not to stop development of other modules
// tells if value is valid (meaning that it only has the fields allowed by the actual projection)
export function respectsProjection<T extends types.Type>(
  type: T,
  projection: projection.Infer<T>,
  value: types.Infer<T>,
): boolean {
  failWithInternalError('TODO: This is not implemented, if you catch this means we forgot an implementation!')
}

/**
 * A record of {@link Projection `Projection`s}.
 */
type Projections = Record<string, types.OptionalType<Projection>>

/**
 * Given a Mondrian {@link Type type}, returns the Mondrian type describing its {@link Projection projection}.
 * You can read {@link here TODO:} to learn more about what projections are and how they can be used.
 *
 * @example ```ts
 *          const model = object({ field1: number, field2: string })
 *          type Projection = InferProjection<typeof model>
 *          Infer<Projection>
 *          // -> true | { field1?: true, field2?: true }
 *          ```
 */
// prettier-ignore
export type FromType<T extends types.Type>
  = [T] extends [types.NumberType] ? types.LiteralType<true>
  : [T] extends [types.StringType] ? types.LiteralType<true>
  : [T] extends [types.BooleanType] ? types.LiteralType<true>
  : [T] extends [types.EnumType<infer _>] ? types.LiteralType<true>
  : [T] extends [types.LiteralType<infer _>] ? types.LiteralType<true>
  : [T] extends [types.CustomType<infer _Name, infer _Options, infer _InferredAs>] ? types.LiteralType<true>
  : [T] extends [types.ArrayType<infer _, infer T1>] ? projection.FromType<T1>
  : [T] extends [types.OptionalType<infer T1>] ? projection.FromType<T1>
  : [T] extends [types.NullableType<infer T1>] ? projection.FromType<T1>
  : [T] extends [types.ReferenceType<infer T1>] ? projection.FromType<T1>
  : [T] extends [(() => infer T1 extends types.Type)] ? projection.FromType<T1>
  : [T] extends [types.UnionType<infer Ts>] ? types.UnionType<{ 
      all: types.LiteralType<true>,
      partial: types.ObjectType<"immutable", { [Key in keyof Ts]: types.OptionalType<projection.FromType<Ts[Key]>> }>
    }>
  : [T] extends [types.ObjectType<infer _, infer Ts>] ? types.UnionType<{
      all: types.LiteralType<true>,
      partial: types.ObjectType<"immutable", { [Key in keyof Ts]: types.OptionalType<projection.FromType<Ts[Key]>> }>
    }>
  : never

/**
 * @param type the type whose projection model is returned
 * @returns the Mondrian model describing the type of valid projections for the given type
 * @example ```ts
 *          const model = object({ field1: number, field2: string })
 *          projectionFromType(model)
 *          // -> union({
 *          //   all: literal(true)
 *          //   partial: object({
 *          //     field1: literal(true).optional()
 *          //     field2: literal(true).optional()
 *          //   })
 *          // })
 *          ```
 */
export function fromType<T extends types.Type>(type: T): projection.FromType<T> {
  const actualType = types.concretise(type)
  switch (actualType.kind) {
    case 'boolean':
    case 'custom':
    case 'literal':
    case 'string':
    case 'enum':
    case 'number':
      return types.literal(true) as projection.FromType<T>
    case 'array':
    case 'nullable':
    case 'optional':
    case 'reference':
      return projection.fromType(actualType.wrappedType) as projection.FromType<T>
    case 'object':
      return projectTypesOrLiteralTrue(actualType.types) as projection.FromType<T>
    case 'union':
      return projectTypesOrLiteralTrue(actualType.variants) as projection.FromType<T>
  }
}

/**
 * Given a record of types, returns a projection type that is either the literal `true` or an object
 * with the projections of the given `types`.
 */
function projectTypesOrLiteralTrue(ts: types.Types): Projection {
  const projectedTypes = filterMapObject(ts, (_, fieldType: any) => projection.fromType(fieldType).optional())
  return types.union({ all: types.literal(true), partial: types.object(projectedTypes) })
}

/**
 * Returns the union type containing the top-level keys of a projection. This doesn't inspect the tree structure
 * of the projection but only stops at the top level. If the projection is not an object it doesn't have any
 * keys and thus this returns the `never` type.
 *
 * @example ```ts
 *          type Projection = InferProjection<typeof number>
 *          ProjectionKeys<Projection>
 *          // -> never
 *          ```
 * @example ```ts
 *          const model = object({ field1: number, field2: object({ inner1: string }) })
 *          type Projection = InferProjection<typeof model>
 *          ProjectionKeys<Projection>
 *          // -> "field1" | "field2"
 *          ```
 */
// prettier-ignore
export type ProjectionKeys<P extends Projection>
  = [P] extends [types.UnionType<{ all: types.LiteralType<true>, partial: types.ObjectType<'immutable', infer Ps extends Projections> }>] ? keyof Ps
  : never

/**
 * Given a {@link Type type} `T` and one of the possible {@link ProjectionKeys keys of its projection},
 * returns the subprojection corresponding to that key.
 *
 * @example ```ts
 *          type Object = ObjectType<{ field1: NumberType, field2: NumberType }>
 *          SubProjection<ObjectType, "field1">
 *          // -> true
 *          ```
 */
// prettier-ignore
export type SubProjection<P extends Projection, K extends ProjectionKeys<P>>
  = [P] extends [types.UnionType<{ all: types.LiteralType<true>, partial: types.ObjectType<'immutable', infer Ps extends Projections> }>] ? Ps[K]
  : never

/**
 * @param projection the {@link Projection projection} to select a subprojection from
 * @param key the key used to select a subprojection from the projection
 * @returns the selected subprojection, if the provided key is `true` the result is always `true`
 * @example ```ts
 *          const model = object({ field: number })
 *          subProjection(model, { field: true }, "field")
 *          // -> true
 *          ```
 * @example ```ts
 *          const model = object({ field: number })
 *          subProjection(model, {}, "field")
 *          // -> undefined
 *          ```
 * @example ```ts
 *          const model = object({ field: number })
 *          subProjection(model, {}, true)
 *          // -> true
 *          ```
 */
export function subProjection<const P extends Projection, K extends ProjectionKeys<P>>(
  projection: P,
  key: K,
): SubProjection<P, K> {
  return projection.kind === 'union'
    ? (projection.variants.partial.types[key] as SubProjection<P, K>)
    : failWithInternalError(
        'It appears that `projection.subProjection` was called on a true projection with a key that should have been inferred as `never`',
      )
}

/**
 * @param projection the projection whose depth is returned
 * @returns the depth of the projection, that is the maximum nesting of the projection
 * @example ```ts
 *          projectionDepth<typeof number>(true)
 *          // -> 0
 *          ```
 * @example ```ts
 *          const model = object({ field1: object({ inner1: number }), field2: number })
 *          projectionDepth<typeof model>({ field1: { inner1: true } })
 *          // -> 2
 *          ```
 */
export function depth<P extends Projection>(projection: P): number {
  if (projection.kind === 'literal') {
    return 0
  } else {
    const innerProjections = Object.values(projection.variants.partial.types)
    const depths = innerProjections.map((inner) => depth(inner.wrappedType))
    return Math.max(-1, ...depths) + 1
  }
}

/**
 * TODO: add doc
 */
// prettier-ignore
export type ProjectedType<T extends types.Type, P extends projection.Infer<T>>
  = [P] extends [true] ? T
  // If P is an object but we have primitive types we cannot perform the projection
  : [T] extends [types.NumberType] ? never
  : [T] extends [types.StringType] ? never
  : [T] extends [types.BooleanType] ? never
  : [T] extends [types.LiteralType<infer _L>] ? never
  : [T] extends [types.EnumType<infer _Vs>] ? never
  : [T] extends [types.CustomType<infer _Name, infer _Options, infer _InferredAs>] ? never
  // If P is an object and we have a wrapper type we perform the projection on the inner type
  : [T] extends [types.ArrayType<infer M, infer T1>] ? [P] extends [projection.Infer<T1>]
      ? types.ArrayType<M, ProjectedType<T1, P>> : never 
  : [T] extends [types.OptionalType<infer T1>] ? [P] extends [projection.Infer<T1>]
      ? types.OptionalType<ProjectedType<T1, P>> : never
  : [T] extends [types.NullableType<infer T1>] ? [P] extends [projection.Infer<T1>]
      ? types.NullableType<ProjectedType<T1, P>> : never
  : [T] extends [(() => infer T1 extends types.Type)] ? [P] extends [projection.Infer<T1>]
      ? ProjectedType<T1, P> : never
  : [T] extends [types.ReferenceType<infer T1>] ? [P] extends [projection.Infer<T1>]
      ? ProjectedType<T1, P> : never
  // If P is an object and we have an object-like type we perform the projection picking the selected fields
  : [T] extends [types.UnionType<infer Ts>] ? [keyof P] extends [keyof Ts]
    ? types.UnionType<{ [K in keyof P]: P extends Record<K, projection.Infer<Ts[K]>> ? ProjectedType<Ts[K], P[K]> : never }> : never
  : [T] extends [types.ObjectType<infer _, infer Ts>] ? [keyof P] extends [keyof Ts]
    ? types.ObjectType<"immutable", { [K in keyof P]: P extends Record<K, projection.Infer<Ts[K]>> ? ProjectedType<Ts[K], P[K]> : never }> : never
  : never

/**
 * TODO: add doc
 */
export function projectedType<T extends types.Type, P extends projection.Infer<T>>(
  type: T,
  projection: P,
): ProjectedType<T, P> {
  return unsafeProjectedType(type, projection)
}

function unsafeProjectedType(type: any, projection: any): any {
  if (projection === true) {
    return type
  }

  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'literal':
    case 'enum':
    case 'custom':
      failWithInternalError(
        'It appears that `projectedType` was called with a simple type and a projection different from `true`. This should not be allowed by the type system and could be an internal error',
      )
    case 'array':
      return unsafeProjectedType(concreteType.wrappedType, projection).array()
    case 'nullable':
      return unsafeProjectedType(concreteType.wrappedType, projection).nullable()
    case 'optional':
      return unsafeProjectedType(concreteType.wrappedType, projection).optional()
    case 'reference':
      return unsafeProjectedType(concreteType.wrappedType, projection)
    case 'object':
      return types.object(unsafeProjectFields(concreteType.types, projection))
    case 'union':
      return types.union(unsafeProjectFields(concreteType.variants, projection))
  }
}

function unsafeProjectFields(types: types.Types, projection: any): Record<string, any> {
  return filterMapObject(projection, (fieldName, subProjection) => unsafeProjectedType(types[fieldName], subProjection))
}

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
