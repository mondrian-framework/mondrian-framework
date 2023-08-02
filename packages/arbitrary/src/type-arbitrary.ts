import { fromType } from './from-type-arbitrary'
import { fc } from '@fast-check/vitest'
import { types } from '@mondrian-framework/model'

const numberOpts = fromType({
  //TODO: min max
  type: types
    .object({
      //multipleOf: types.number({ minimum: [0, 'exclusive'] }).optional(),
    })
    .optional(),
})
const number = numberOpts.map(types.number)
const boolean = fc.constant(types.boolean())
const stringOpts = fromType({
  type: types
    .object({
      minLength: types.integer({ minimum: [0, 'inclusive'], maximum: [128, 'inclusive'] }).optional(),
      maxLength: types.integer({ minimum: [0, 'inclusive'], maximum: [128, 'inclusive'] }).optional(),
    })
    .optional(),
}).filter((opts) => opts?.maxLength == null || opts.minLength == null || opts.maxLength > opts.minLength)
const string = stringOpts.map(types.string)
const literal = fc.oneof(fc.string(), fc.boolean(), fc.double(), fc.constant(null)).map(types.literal)
const enumeration = fc
  .array(fc.string(), { minLength: 1, maxLength: 20 })
  .map(([head, ...tail]) => types.enumeration([head, ...tail]))
const flatTypes = [number, boolean, string, literal, enumeration] //TODO: customs
const flatTypesArbitrary = applyDecorators(fc.oneof(...flatTypes))
const arrayOpts = fromType({
  type: types
    .object({
      minItems: types.integer({ minimum: [0, 'inclusive'], maximum: [10, 'inclusive'] }).optional(),
      maxItems: types.integer({ minimum: [0, 'inclusive'], maximum: [10, 'inclusive'] }).optional(),
    })
    .optional(),
}).filter((opts) => opts?.maxItems == null || opts.minItems == null || opts.maxItems > opts.minItems)

export function type(maxDepth: number = 5): fc.Arbitrary<types.Type> {
  if (maxDepth <= 1) {
    return flatTypesArbitrary
  }
  const subTypeArbitrary = type(maxDepth - 1)
  const array = arrayOpts.chain((opts) => subTypeArbitrary.map((t) => types.array(t, opts)))
  const object = fc.array(fc.tuple(fc.string(), subTypeArbitrary)).map(Object.fromEntries).map(types.object)
  //TODO: union?
  return applyDecorators(fc.oneof(object, array, ...flatTypes))
}

function applyDecorators(arbitrary: fc.Arbitrary<types.Type>): fc.Arbitrary<types.Type> {
  return arbitrary
    .chain((t) => fc.tuple(fc.constant(t), fc.boolean()))
    .map(([t, isNullable]) => (isNullable ? types.nullable(t) : t))
    .chain((t) => fc.tuple(fc.constant(t), fc.boolean()))
    .map(([t, isOptinoal]) => (isOptinoal ? types.optional(t) : t))
    .chain((t) => fc.tuple(fc.constant(t), fc.boolean()))
    .map(([t, isReference]) => (isReference ? types.reference(t) : t))
    .chain((t) => fc.tuple(fc.constant(t), fc.boolean()))
    .map(([t, isLazy]) => (isLazy ? () => t : t))
}
