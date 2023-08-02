import { fc } from '@fast-check/vitest'
import { types } from '@mondrian-framework/model'
import { match } from 'ts-pattern'

export type CustomMap<T extends types.Type> = CustomMapInternal<T, []>

// prettier-ignore
type CustomMapInternal<T extends types.Type, Visited extends types.Type[]> 
  = [T] extends [types.NumberType] ? {}
  : [T] extends [types.StringType] ? {}
  : [T] extends [types.BooleanType] ? {}
  : [T] extends [types.EnumType<any>] ? {}
  : [T] extends [types.LiteralType<any>] ? {}
  : [T] extends [types.UnionType<infer Ts>] ? keyof Ts extends never ? {} : UnionToIntersection<{ [Key in keyof Ts]: CustomMapInternal<Ts[Key], Visited> }[keyof Ts]>
  : [T] extends [types.ObjectType<any, infer Ts>] ? keyof Ts extends never ? {} : UnionToIntersection<{ [Key in keyof Ts]: CustomMapInternal<Ts[Key], Visited> }[keyof Ts]>
  : [T] extends [types.ArrayType<any, infer T1>] ? CustomMapInternal<T1, Visited>
  : [T] extends [types.OptionalType<infer T1>] ? CustomMapInternal<T1, Visited>
  : [T] extends [types.NullableType<infer T1>] ? CustomMapInternal<T1, Visited>
  : [T] extends [types.ReferenceType<infer T1>] ?  CustomMapInternal<T1, Visited>
  : [T] extends [types.CustomType<infer Name, infer Options, infer InferredAs>] ? { [K in Name]: (options?: Options) => fc.Arbitrary<InferredAs> }
  : [T] extends [(() => infer T1 extends types.Type)] ? WasAlredyVisited<Visited, T> extends false ? CustomMapInternal<T1, [...Visited, T]> : {}
  : {}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

type WasAlredyVisited<Ts extends types.Type[], T extends types.Type> = Ts extends []
  ? false
  : Ts extends [infer Head, ...infer _Tail]
  ? [Head] extends [T]
    ? true
    : false
  : false

type CustomMapArgument<T extends types.Type> = CustomMap<T> extends infer R
  ? keyof R extends never
    ? { customArbitraries?: {} }
    : { customArbitraries: R }
  : never

export function fromType<T extends types.Type>({
  type,
  maxDepth,
  customArbitraries,
}: { type: T; maxDepth?: number } & CustomMapArgument<T>): fc.Arbitrary<types.Infer<T>> {
  const depth = maxDepth ?? 5
  return match(types.concretise(type))
    .with({ kind: 'boolean' }, (_type) => fc.boolean())
    .with({ kind: 'number' }, (type) => {
      const multipleOf = type.options?.multipleOf
      if (multipleOf) {
        const [min, minInclusive] = type.options.minimum ?? [undefined, 'inclusive']
        const [max, maxInclusive] = type.options.maximum ?? [undefined, 'inclusive']
        let minIndex = min != null ? Math.round(min / multipleOf + (0.5 - Number.EPSILON)) : undefined
        let maxIndex = max != null ? Math.round(max / multipleOf - (0.5 - Number.EPSILON)) : undefined
        if (maxIndex != null && maxInclusive === 'exclusive' && maxIndex * multipleOf === max) {
          maxIndex--
        }
        if (minIndex != null && minInclusive === 'exclusive' && minIndex * multipleOf === min) {
          minIndex++
        }
        return fc.integer({ min: minIndex, max: maxIndex }).map((v) => v * multipleOf)
      }
      return fc.double({ min: type.options?.minimum?.[0], max: type.options?.maximum?.[0] })
    })
    .with({ kind: 'string' }, (type) =>
      type.options?.regex
        ? fc.stringMatching(type.options.regex).filter((s) => {
            if (type.options?.maxLength && s.length > type.options.maxLength) {
              return false
            }
            if (type.options?.minLength && s.length < type.options.minLength) {
              return false
            }
            return true
          })
        : fc.string({ maxLength: type.options?.maxLength, minLength: type.options?.minLength }),
    )
    .with({ kind: 'literal' }, (type) => fc.constant(type.literalValue))
    .with({ kind: 'enum' }, (type) => fc.oneof(...type.variants.map(fc.constant)))
    .with({ kind: 'optional' }, (type) =>
      depth <= 1
        ? fc.constant(undefined)
        : fc.oneof(
            fc.constant(undefined),
            fromType({ type: type.wrappedType, maxDepth: depth - 1, customArbitraries }),
          ),
    )
    .with({ kind: 'nullable' }, (type) =>
      depth <= 1
        ? fc.constant(null)
        : fc.oneof(fc.constant(null), fromType({ type: type.wrappedType, maxDepth: depth - 1, customArbitraries })),
    )
    .with({ kind: 'union' }, (type) =>
      fc.oneof(
        ...Object.values(type.variants).map((v) =>
          fromType({ type: v as types.Type, maxDepth: depth - 1, customArbitraries }),
        ),
      ),
    )
    .with({ kind: 'object' }, (type) =>
      fc.record(
        Object.fromEntries(
          Object.entries(type.types).map(([k, st]) => [
            k,
            fromType({ type: st as types.Type, maxDepth: depth - 1, customArbitraries }),
          ]),
        ),
      ),
    )
    .with({ kind: 'array' }, (type) =>
      depth <= 1 && (type.options?.minItems ?? 0) <= 0
        ? fc.constant([])
        : fc.array(fromType({ type: type.wrappedType, maxDepth: depth - 1, customArbitraries }), {
            maxLength: type.options?.maxItems,
            minLength: type.options?.minItems,
          }),
    )
    .with({ kind: 'reference' }, (type) => fromType({ type: type.wrappedType, maxDepth: depth - 1, customArbitraries }))
    .with({ kind: 'custom' }, (type) => {
      const arbitrary = (customArbitraries as Record<string, (options?: types.BaseOptions) => fc.Arbitrary<unknown>>)[
        type.typeName
      ]
      if (!arbitrary) {
        throw new Error(`Need arbitrary for custom type "${type.typeName}"`)
      }
      return arbitrary(type.options)
    })
    .exhaustive() as fc.Arbitrary<types.Infer<T>>
}
