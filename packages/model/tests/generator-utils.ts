import { Infer, Type, concretise } from '../src'
import { fc as gen } from '@fast-check/vitest'
import { match } from 'ts-pattern'

export function nonEmptyArray<T>(generator: gen.Arbitrary<T>): gen.Arbitrary<[T, ...T[]]> {
  return generator.chain((head) => gen.array(generator).map((tail) => [head, ...tail]))
}

export function getArbitrary<T extends Type>(type: T): gen.Arbitrary<Infer<T>> {
  const value = match(concretise(type))
    .with({ kind: 'boolean' }, (_type) => gen.boolean())
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
        return gen.integer({ min: minIndex, max: maxIndex }).map((v) => v * multipleOf)
      }
      return gen.double({ min: type.options?.minimum?.[0], max: type.options?.maximum?.[0] })
    })
    .with(
      { kind: 'string' },
      (type) =>
        gen
          .string({ maxLength: type.options?.maxLength, minLength: type.options?.minLength })
          .filter((v) => type.options?.regex?.test(v) ?? true), //TODO: inefficient https://github.com/fent/randexp.js
    )
    .with({ kind: 'literal' }, (type) => gen.constant(type.literalValue))
    .with({ kind: 'enum' }, (type) => gen.oneof(type.variants.map(gen.constant)))
    .with({ kind: 'optional' }, (type) => gen.oneof(gen.constant(undefined), getArbitrary(type.wrappedType)))
    .with({ kind: 'nullable' }, (type) => gen.oneof(gen.constant(null), getArbitrary(type.wrappedType)))
    .with({ kind: 'union' }, (type) => gen.oneof(...Object.values(type.variants).map((v) => getArbitrary(v as Type))))
    .with({ kind: 'object' }, (type) =>
      gen.record(Object.fromEntries(Object.entries(type.types).map(([k, st]) => [k, getArbitrary(st as Type)]))),
    )
    .with({ kind: 'array' }, (type) =>
      gen.array(getArbitrary(type.wrappedType), {
        maxLength: type.options?.maxItems,
        minLength: type.options?.minItems,
      }),
    )
    .with({ kind: 'reference' }, (type) => getArbitrary(type.wrappedType))
    .with({ kind: 'custom' }, (type) => type.arbitrary)
    .exhaustive()

  return value as gen.Arbitrary<Infer<T>>
}
