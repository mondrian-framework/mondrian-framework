import {
  ArrayType,
  BooleanType,
  CustomType,
  EnumType,
  Infer,
  LiteralType,
  NullableType,
  NumberType,
  ObjectType,
  OptionalType,
  ReferenceType,
  StringType,
  Type,
  Types,
  UnionType,
  array,
  concretise,
  literal,
  nullable,
  object,
  optional,
  union,
} from './type-system'
import { filterMapObject } from './utils'
import { assertNever } from '@mondrian-framework/utils'

/**
 * This is the Mondrian type describing the structure of a projection: it is either the literal value
 * `true` or a union composed of two variants: an `all` variant (which is again the literal `true`) and
 * a `partial` variant which describes a subprojection with possibly many fields; this is why it is described
 * by an `ObjectType` whose fields can themselves only be valid projections.
 */
type ProjectionType =
  | LiteralType<true>
  | UnionType<{ all: LiteralType<true>; partial: ObjectType<'immutable', ProjectionTypes> }>

/**
 * A record of {@link ProjectionType `ProjectionType`s}.
 */
type ProjectionTypes = Record<string, OptionalType<ProjectionType>>

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
export type InferProjection<T extends Type>
  = [T] extends [NumberType] ? LiteralType<true>
  : [T] extends [StringType] ? LiteralType<true>
  : [T] extends [BooleanType] ? LiteralType<true>
  : [T] extends [EnumType<infer _>] ? LiteralType<true>
  : [T] extends [LiteralType<infer _>] ? LiteralType<true>
  : [T] extends [CustomType<infer _Name, infer _Options, infer _InferredAs>] ? LiteralType<true>
  : [T] extends [ArrayType<infer _, infer T1>] ? InferProjection<T1>
  : [T] extends [OptionalType<infer T1>] ? InferProjection<T1>
  : [T] extends [NullableType<infer T1>] ? InferProjection<T1>
  : [T] extends [ReferenceType<infer T1>] ? InferProjection<T1>
  : [T] extends [(() => infer T1 extends Type)] ? InferProjection<T1>
  : [T] extends [UnionType<infer Ts>] ? UnionType<{ 
      all: LiteralType<true>,
      partial: ObjectType<"immutable", { [Key in keyof Ts]: OptionalType<InferProjection<Ts[Key]>> }>
    }>
  : [T] extends [ObjectType<infer _, infer Ts>] ? UnionType<{
      all: LiteralType<true>,
      partial: ObjectType<"immutable", { [Key in keyof Ts]: OptionalType<InferProjection<Ts[Key]>> }>
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
export function projectionFromType<T extends Type>(type: T): InferProjection<T> {
  const actualType = concretise(type)
  switch (actualType.kind) {
    case 'boolean':
    case 'custom':
    case 'literal':
    case 'string':
    case 'enum':
    case 'number':
      return literal(true) as InferProjection<T>
    case 'array':
    case 'nullable':
    case 'optional':
    case 'reference':
      return projectionFromType(actualType.wrappedType) as InferProjection<T>
    case 'object':
      return projectTypesOrLiteralTrue(actualType.types) as InferProjection<T>
    case 'union':
      return projectTypesOrLiteralTrue(actualType.variants) as InferProjection<T>
  }
}

/**
 * Given a record of types, returns a projection type that is either the literal `true` or an object
 * with the projections of the given `types`.
 */
function projectTypesOrLiteralTrue(types: Types): ProjectionType {
  const projectedTypes = filterMapObject(types, (_, fieldType: any) => projectionFromType(fieldType).optional())
  return union({ all: literal(true), partial: object(projectedTypes) })
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
export type ProjectionKeys<P extends ProjectionType>
  = [P] extends [UnionType<{ all: LiteralType<true>, partial: ObjectType<'immutable', infer Ps extends ProjectionTypes> }>] ? keyof Ps
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
export type SubProjection<P extends ProjectionType, K extends ProjectionKeys<P>>
  = [P] extends [UnionType<{ all: LiteralType<true>, partial: ObjectType<'immutable', infer Ps extends ProjectionTypes> }>] ? Ps[K]
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
export function subProjection<const T extends Type, K extends ProjectionKeys<T>>(
  _type: T,
  projection: Infer<InferProjection<T>>,
  key: K,
): SubProjection<T, K> {
  if (projection === true || key === true) {
    return true as SubProjection<T, K>
  } else {
    // Otherwise we are guaranteed that `key` is one of the keys of the projection by the types,
    // that is why we can safely access it here
    return (projection as any)[key]
  }
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
export function projectionDepth<T extends Type>(projection: InferProjection<T>): number {
  if (typeof projection === 'object') {
    const innerProjections = Object.values(projection) as unknown as InferProjection<T>[]
    const depths = innerProjections.map(projectionDepth)
    return Math.max(-1, ...depths) + 1
  } else {
    return 0
  }
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
