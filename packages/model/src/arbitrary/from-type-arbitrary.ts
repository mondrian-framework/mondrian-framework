import { arbitrary, types } from '../index'
import { assertNever, failWithInternalError } from '../utils'
import gen from 'fast-check'

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
  : [T] extends [types.ObjectType<any, infer Ts>] ? keyof Ts extends never ? {} : UnionToIntersection<{ [Key in keyof Ts]: CustomMapInternal<types.UnwrapField<Ts[Key]>, Visited> }[keyof Ts]>
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
export function fromType<T extends types.Type>(
  type: T,
  customArbitraries: CustomMapArgument<T>,
  maxDepth = 5,
): gen.Arbitrary<types.Infer<T>> {
  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case types.Kind.Boolean:
      return gen.boolean() as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Number:
      return numberMatchingOptions(concreteType.options) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.String:
      return stringMatchingOptions(concreteType.options) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Literal:
      return gen.constant(concreteType.literalValue) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Enum:
      return gen.constantFrom(...concreteType.variants) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Optional:
      return wrapInOptional(maxDepth, concreteType.wrappedType, customArbitraries) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Nullable:
      return wrapInNullable(maxDepth, concreteType.wrappedType, customArbitraries) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Union:
      return unionFromVariants(maxDepth, concreteType.variants, customArbitraries) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Object:
      return objectFromFields(maxDepth, concreteType.fields, customArbitraries) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Array:
      return arrayFromOptions(
        maxDepth,
        concreteType.wrappedType,
        concreteType.options,
        customArbitraries,
      ) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Reference:
      return fromType(concreteType.wrappedType, customArbitraries, maxDepth - 1) as gen.Arbitrary<types.Infer<T>>
    case types.Kind.Custom:
      return generatorFromArbitrariesMap(
        concreteType.typeName,
        concreteType.options,
        customArbitraries,
      ) as gen.Arbitrary<types.Infer<T>>
    default:
      const message = `\`fromType\` was called with a type kind that it cannot handle but this call should have been made impossible by the type system's checks`
      assertNever(concreteType, message)
  }
}

export function typeAndValue(typeDepth: number = 3, valueDepth: number = 3): gen.Arbitrary<[types.Type, never]> {
  return arbitrary
    .type(typeDepth)
    .filter(canGenerateValueFrom)
    .chain((type) => {
      return arbitrary.fromType(type, {}, valueDepth).map((value) => {
        return [type, value]
      })
    })
}

// TODO: doc
export function canGenerateValueFrom(type: types.Type): boolean {
  // This is just an ugly hack for now but really effective! If the constructor does not throw then I can
  // generate a type for it
  try {
    arbitrary.fromType(type, {})
    return true
  } catch {
    return false
  }
}

function numberMatchingOptions(options: types.OptionsOf<types.NumberType> | undefined): gen.Arbitrary<number> {
  if (options) {
    return options.isInteger ? integerMatchingOptions(options) : doubleMatchingOptions(options)
  } else {
    return gen.double()
  }
}

function doubleMatchingOptions(options: types.OptionsOf<types.NumberType>): gen.Arbitrary<number> {
  const { minimum, exclusiveMinimum, maximum, exclusiveMaximum } = options
  const min = selectMinimum(minimum, exclusiveMinimum)
  const max = selectMaximum(maximum, exclusiveMaximum)
  return gen.double({ ...min, ...max, noNaN: true })
}

function integerMatchingOptions(options: types.OptionsOf<types.NumberType>): gen.Arbitrary<number> {
  const { minimum, exclusiveMinimum, maximum, exclusiveMaximum } = options
  if (
    (minimum && !Number.isInteger(minimum)) ||
    (maximum && !Number.isInteger(maximum)) ||
    (exclusiveMinimum && !Number.isInteger(exclusiveMinimum)) ||
    (exclusiveMaximum && !Number.isInteger(exclusiveMaximum))
  ) {
    throw new Error('I cannot generate values from integer number types whose max/min are not integer numbers')
  }
  const min = selectMinimum(minimum, exclusiveMinimum)
  const max = selectMaximum(maximum, exclusiveMaximum)
  return gen.integer({ ...min, ...max })
}

function selectMinimum(
  inclusive: number | undefined,
  exclusive: number | undefined,
): { minExcluded: boolean; min: number } | undefined {
  if (inclusive && exclusive) {
    if (inclusive > exclusive) {
      return { minExcluded: false, min: inclusive }
    } else {
      return { minExcluded: true, min: exclusive }
    }
  } else if (inclusive) {
    return { minExcluded: false, min: inclusive }
  } else if (exclusive) {
    return { minExcluded: true, min: exclusive }
  } else {
    return undefined
  }
}

function selectMaximum(
  inclusive: number | undefined,
  exclusive: number | undefined,
): { maxExcluded: boolean; max: number } | undefined {
  if (inclusive && exclusive) {
    if (inclusive < exclusive) {
      return { maxExcluded: false, max: inclusive }
    } else {
      return { maxExcluded: true, max: exclusive }
    }
  } else if (inclusive) {
    return { maxExcluded: false, max: inclusive }
  } else if (exclusive) {
    return { maxExcluded: true, max: exclusive }
  } else {
    return undefined
  }
}

function stringMatchingOptions(options?: types.OptionsOf<types.StringType>) {
  if (!options) {
    return gen.string()
  } else {
    const { regex, minLength, maxLength } = options
    if ((regex && minLength) || (regex && maxLength)) {
      const message = 'I cannot generate values from string types that have both a regex and min/max length defined'
      throw new Error(message)
    } else {
      return !regex ? gen.string({ maxLength, minLength }) : gen.stringMatching(regex)
    }
  }
}

function wrapInOptional(depth: number, wrappedType: types.Type, customArbitraries: CustomMapArgument<types.Type>) {
  return depth <= 1
    ? gen.constant(undefined)
    : gen.oneof(gen.constant(undefined), fromType(wrappedType, customArbitraries, depth - 1))
}

function wrapInNullable(depth: number, wrappedType: types.Type, customArbitraries: CustomMapArgument<types.Type>) {
  return depth <= 1
    ? gen.constant(null)
    : gen.oneof(gen.constant(null), fromType(wrappedType, customArbitraries, depth - 1))
}

function unionFromVariants(depth: number, variants: types.Types, customArbitraries: CustomMapArgument<types.Type>) {
  const toVariantGenerator = ([variantName, variantType]: [string, types.Type]) =>
    fromType(variantType, customArbitraries, depth - 1).map((variantValue) => {
      return Object.fromEntries([[variantName, variantValue]])
    })

  const variantsGenerators = Object.entries(variants).map(toVariantGenerator)
  return gen.oneof(...variantsGenerators)
}

function objectFromFields(depth: number, fields: types.Types, customArbitraries: CustomMapArgument<types.Type>) {
  // prettier-ignore
  const toEntryGenerator = ([fieldName, fieldType]: [string, types.Type]) =>
    [fieldName, fromType(fieldType, customArbitraries, depth - 1)] as const
  const entriesGenerators = Object.entries(fields).map(toEntryGenerator)
  return gen.record(Object.fromEntries(entriesGenerators))
}

function arrayFromOptions(
  depth: number,
  wrappedType: types.Type,
  options: types.OptionsOf<types.ArrayType<any, any>> | undefined,
  customArbitraries: CustomMapArgument<types.Type>,
) {
  return gen.array(fromType(wrappedType, customArbitraries, depth - 1), {
    maxLength: options?.maxItems,
    minLength: options?.minItems,
  })
}

function generatorFromArbitrariesMap(typeName: string, options: any, customArbitraries: CustomMapArgument<types.Type>) {
  const arbitrary = (customArbitraries as any)[typeName]
  if (!arbitrary) {
    const errorMessage = `\`fromType\` was given a map of cutom type generators that doesn't contain the generator for the type "${typeName}", this should have been impossible thanks to type checking`
    failWithInternalError(errorMessage)
  } else {
    return arbitrary(options)
  }
}
