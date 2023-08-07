import { types } from '../index'
import gen from 'fast-check'
import { failWithInternalError } from 'src/utils'
import { match } from 'ts-pattern'
import { select } from 'ts-pattern/dist/patterns'

// TODO: Missing doc
export type CustomMap<T extends types.Type> = CustomMapInternal<T, []>

// TODO: Missing doc
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
  : [T] extends [types.CustomType<infer Name, infer Options, infer InferredAs>] ? { [K in Name]: (options?: Options) => gen.Arbitrary<InferredAs> }
  : [T] extends [(() => infer T1 extends types.Type)] ? WasAlredyVisited<Visited, T> extends false ? CustomMapInternal<T1, [...Visited, T]> : {}
  : {}

// TODO: Missing doc
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

// TODO: Missing doc
// prettier-ignore
type WasAlredyVisited<Ts extends types.Type[], T extends types.Type>
  = Ts extends [] ? false
  : Ts extends [infer Head, ...infer _Tail]
    ? [Head] extends [T] ? true : false
  : false

// TODO: missing doc
// prettier-ignore
type CustomMapArgument<T extends types.Type>
  = CustomMap<T> extends infer R ? keyof R extends never
    ? { customArbitraries?: {} } : { customArbitraries: R }
  : never

/**
 * Build an Arbitrary that generates values that respect the given type T.
 */
// TODO: refactor move things out of the pattern matching branches to make
//       it easier to reason about each step
export function fromType<T extends types.Type>(
  type: T,
  customArbitraries: CustomMapArgument<T>,
  maxDepth = 5,
): gen.Arbitrary<types.Infer<T>> {
  const depth = maxDepth ?? 5
  return match(types.concretise(type))
    .with({ kind: 'boolean' }, (_type) => gen.boolean())
    .with({ kind: 'number' }, (type) => numberMatchingOptions(type.options))
    .with({ kind: 'string' }, (type) => {
      return type.options?.regex
        ? gen.stringMatching(type.options.regex).filter((s) => {
            if (type.options?.maxLength && s.length > type.options.maxLength) {
              return false
            }
            if (type.options?.minLength && s.length < type.options.minLength) {
              return false
            }
            return true
          })
        : gen.string({ maxLength: type.options?.maxLength, minLength: type.options?.minLength })
    })

    .with({ kind: 'literal' }, (type) => gen.constant(type.literalValue))
    .with({ kind: 'enum' }, (type) => gen.constantFrom(...type.variants))
    .with({ kind: 'optional' }, (type) =>
      depth <= 1
        ? gen.constant(undefined)
        : gen.oneof(gen.constant(undefined), fromType(type.wrappedType, customArbitraries, depth - 1)),
    )
    .with({ kind: 'nullable' }, (type) =>
      depth <= 1
        ? gen.constant(null)
        : gen.oneof(gen.constant(null), fromType(type.wrappedType, customArbitraries, depth - 1)),
    )
    .with({ kind: 'union' }, (type) =>
      gen.oneof(
        ...Object.values(type.variants).map((variantType) =>
          fromType(variantType as types.Type, customArbitraries, depth - 1),
        ),
      ),
    )
    .with({ kind: 'object' }, (type) =>
      gen.record(
        Object.fromEntries(
          Object.entries(type.types).map(([fieldName, fieldType]) => [
            fieldName,
            fromType(fieldType as types.Type, customArbitraries, depth - 1),
          ]),
        ),
      ),
    )
    .with({ kind: 'array' }, (type) =>
      depth <= 1 && (type.options?.minItems ?? 0) <= 0
        ? gen.constant([])
        : gen.array(fromType(type.wrappedType, customArbitraries, depth - 1), {
            maxLength: type.options?.maxItems,
            minLength: type.options?.minItems,
          }),
    )
    .with({ kind: 'reference' }, (type) => fromType(type.wrappedType, customArbitraries, depth - 1))
    .with({ kind: 'custom' }, (type) => {
      const arbitrary = (customArbitraries as any)[type.typeName]
      //TODO: check this: (customArbitraries as Record<string, (options?: types.BaseOptions) => gen.Arbitrary<unknown>>)[
      //  type.typeName
      //]
      if (!arbitrary) {
        const errorMessage = `\`fromType\` was given a map of cutom type generators that doesn't contain the generator for the type "${type.typeName}", this should have been impossible thanks to type checking`
        failWithInternalError(errorMessage)
      } else {
        return arbitrary(type.options)
      }
    })
    .exhaustive() as gen.Arbitrary<types.Infer<T>>
}

function numberMatchingOptions(options: types.OptionsOf<types.NumberType> | undefined): gen.Arbitrary<number> {
  if (options) {
    const { multipleOf, maximum, minimum, exclusiveMaximum, exclusiveMinimum } = options
    const lowerBound = selectMinimum(minimum, exclusiveMinimum, multipleOf)
    const upperBound = selectMaximum(maximum, exclusiveMaximum, multipleOf)
    const generatorOptions = { ...lowerBound, ...upperBound }
    return multipleOf
      ? gen.integer(generatorOptions).map((n) => n * multipleOf)
      : gen.oneof(gen.integer(generatorOptions), gen.double(generatorOptions))
  } else {
    return gen.oneof(gen.integer(), gen.float())
  }
}

function selectMinimum(
  inclusive: number | undefined,
  exclusive: number | undefined,
  multipleOf: number | undefined,
): { minExcluded: boolean; min: number } | undefined {
  const adaptToMultiple = (n: number) => (!multipleOf ? n : Math.round(n / multipleOf + (0.5 - Number.EPSILON)))

  if (inclusive && exclusive) {
    if (inclusive > exclusive) {
      return { minExcluded: false, min: adaptToMultiple(inclusive) }
    } else {
      return { minExcluded: true, min: adaptToMultiple(exclusive) }
    }
  } else if (inclusive) {
    return { minExcluded: false, min: adaptToMultiple(inclusive) }
  } else if (exclusive) {
    return { minExcluded: true, min: adaptToMultiple(exclusive) }
  } else {
    return undefined
  }
}

function selectMaximum(
  inclusive: number | undefined,
  exclusive: number | undefined,
  multipleOf: number | undefined,
): { maxExcluded: boolean; max: number } | undefined {
  const adaptToMultiple = (n: number) => (!multipleOf ? n : Math.round(n / multipleOf - (0.5 - Number.EPSILON)))

  if (inclusive && exclusive) {
    if (inclusive < exclusive) {
      return { maxExcluded: false, max: adaptToMultiple(inclusive) }
    } else {
      return { maxExcluded: true, max: adaptToMultiple(exclusive) }
    }
  } else if (inclusive) {
    return { maxExcluded: false, max: adaptToMultiple(inclusive) }
  } else if (exclusive) {
    return { maxExcluded: true, max: adaptToMultiple(exclusive) }
  } else {
    return undefined
  }
}
