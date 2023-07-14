import {
  ArrayType,
  BooleanType,
  EnumType,
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
  nullable,
  object,
  optional,
  union,
} from './type-system'
import { assertNever } from '@mondrian-framework/utils'

/**
 * Gets the type of a valid projection for a given type of the Mondrian framework.
 * A projection can define... TODO
 */
// prettier-ignore
export type Projection<T extends Type>
  = [T] extends [NumberType] ? true
  : [T] extends [StringType] ? true
  : [T] extends [BooleanType] ? true
  : [T] extends [EnumType<infer _Vs>] ? true
  : [T] extends [LiteralType<infer _L>] ? true
  : [T] extends [UnionType<infer Ts>] ? { readonly [Key in keyof Ts]?: Projection<Ts[Key]> } | true
  : [T] extends [ArrayType<infer _M, infer T1>] ? Projection<T1>
  : [T] extends [OptionalType<infer T1>] ? Projection<T1>
  : [T] extends [NullableType<infer T1>] ? Projection<T1>
  : [T] extends [ReferenceType<infer T1>] ? Projection<T1>
  : [T] extends [(() => infer T1 extends Type)] ? Projection<T1>
  : [T] extends [ObjectType<infer _M, infer Ts>] ? { readonly [Key in keyof Ts]?: Projection<Ts[Key]> } | true
  : never

/**
 * @param projection the projection to check
 * @param type the {@link Type type} that `projection` has to conform to
 * @returns true if the given `projection` is actually a valid projection for the given `type`
 */
export function isProjection<T extends Type>(projection: unknown, type: T): projection is Projection<T> {
  // The literal true is always a valid projection for any given type
  if (projection === true) {
    return true
  }
  // A null projection is never valid
  if (projection === null) {
    return false
  }
  // Here we made sure that projection is not `true`, so now we check for other options
  const concreteType = concretise(type)
  const kind = concreteType.kind
  if (kind === 'number' || kind === 'string' || kind === 'boolean' || kind === 'enum' || kind === 'literal') {
    // For the base type the only allowed projection is the literal true, since here we're sure that `projection` is not
    // `true` we're sure that it cannot be a valid projection for those types
    return false
  } else if (kind === 'array' || kind === 'optional' || kind === 'nullable' || kind === 'reference') {
    // In case of types that wrap an inner type we check if the projection is valid for the wrapped type
    return isProjection(projection, concreteType.wrappedType)
  } else if (kind === 'object') {
    // If type is an object the only possible valid projection is itself an object and a valid projection
    return typeof projection !== 'object' ? false : checkIsObjectProjection(concreteType, projection)
  } else if (kind === 'union') {
    return typeof projection !== 'object' ? false : checkIsUnionProjection(concreteType, projection)
  } else {
    // Here type is never since we've already checked all options!
    // This branch is unreachable so we return `false` as a default
    return false
  }
}

/**
 * Checks if an object is a valid projection for a given object type: `projection` must contain only the fields defined
 * by `type` (but could also contain less fields than type), and each field must itself be a valid projection for the
 * corresponding type.
 */
function checkIsObjectProjection<Ts extends Types>(type: ObjectType<any, Ts>, projection: object): boolean {
  for (const [fieldName, subProjection] of Object.entries(projection)) {
    const subType = type.types[fieldName]
    // If there is no field with a name of the fields of `projection`
    if (subType === undefined || !isProjection(subProjection, subType)) {
      return false
    }
  }
  return true
}

/**
 * Checks if an object is a valid projection for a given union type: `projection` must contain only fields with the same
 * name as the type variants (but could also contain less fields), and each field must itself be a valid projection for
 * the corresponding variant.
 */
function checkIsUnionProjection<Ts extends Types>(type: UnionType<Ts>, projection: object): boolean {
  for (const [fieldName, subProjection] of Object.entries(projection)) {
    const variantType = type.variants[fieldName]
    // If there is no variant with a name of the fields of `projection`
    if (variantType === undefined || !isProjection(subProjection, variantType)) {
      return false
    }
  }
  return true
}

/**
 * Gets the keys of a given projection
 *
 * @example ```ts
 *          type Ks = ProjectionKeys<NumberType>
 *          // -> Ks = never
 *          // a projection for a number can only be `true` and doesn't have any keys
 *          ```
 * @example ```ts
 *          type Ks = ProjectionKeys<ObjectType<"mutable", { field1: NumberType, field2: NumberType }>>
 *          // -> Ks = "field1" | "field2"
 *          // an object has a projection that has a key for each of its fields
 *          ```
 * @example ```ts
 *          type Ks = ProjectionKeys<UnionType<{ variant1: NumberType, variant2: StringType }>>
 *          // -> Ks = "variant1" | "variant2"
 *          // a union has a projection that has a key for each of its variants
 *          ```
 */
// prettier-ignore
export type ProjectionKeys<T extends Type>
  = [Projection<T>] extends [true] ? never
  : [Projection<T>] extends [true | infer R extends Record<string, any>] ? keyof R
  : never

/**
 * Given a {@link Type type} `T` and one of the possible keys of its projection, returns the subprojection corresponding
 * to that key.
 *
 * @example ```ts
 *          type Object = ObjectType<{ field1: NumberType, field2: NumberType }>
 *          type Sub = SubProjection<ObjectType, "field1">
 *          // -> Sub = true
 *          // Sub it the projection of "field1"
 *          ```
 */
// prettier-ignore
export type SubProjection<T extends Type, Ks extends ProjectionKeys<T>>
  = [Projection<T>] extends [true] ? true
  : [Projection<T>] extends [true | infer R extends Record<string, any>] ? Exclude<R[Ks], undefined>
  : never

/**
 * @param projection the {@link Projection projection} to select a subprojection from
 * @param key the key used to select a subprojection from the projection
 * @returns the selected subprojection
 */
export function subProjection<const T extends Type, K extends ProjectionKeys<T>>(
  projection: Projection<T>,
  key: K,
): SubProjection<T, K> {
  if (projection === true) {
    // This path can never happen: if the projection is `true` then its `ProjectionKeys` are `never` meaning that key
    // would have to be `never`, but that is impossible
    throw new Error(
      "called sub projection on a projection that doesn't have a subprojection, this code path should be unreachable",
    )
  } else {
    // Otherwise we are guaranteed that `key` is one of the keys of the projection by the types,
    // that is why we can safely access it here
    return (projection as any)[key]
  }
}

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

export function projectionDepth(p: GenericProjection, start = 0): number {
  if (typeof p === 'object') {
    const max = Object.values(p).reduce((depth, sb) => {
      const d = sb ? projectionDepth(sb, start + 1) : start
      return d > depth ? d : depth
    }, start)
    return max
  }
  return start
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
