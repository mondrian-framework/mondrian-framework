import { Infer, Type, concretise } from '../src'
import { fc as gen } from '@fast-check/vitest'
import { match } from 'ts-pattern'

export function nonEmptyArray<T>(generator: gen.Arbitrary<T>): gen.Arbitrary<[T, ...T[]]> {
  return generator.chain((head) => gen.array(generator).map((tail) => [head, ...tail]))
}

export function getArbitrary<T extends Type>(type: T, maxDepth: number = 2): gen.Arbitrary<Infer<T>> {
  if (maxDepth < 0) {
    throw new Error('Max depth reached!')
  }
  const value = match(concretise(type))
    .with({ kind: 'boolean' }, (_type) => gen.boolean())
    .with({ kind: 'number' }, (type) => {
      if (type.options?.multipleOf) {
        const m = type.options.multipleOf
        const min = type.options.minimum?.[0] //TODO: check inclusive / exclusive
        const max = type.options.maximum?.[0]
        return gen
          .integer({
            min: min != null ? Math.round(min / m + (0.5 - Number.EPSILON)) : undefined,
            max: max != null ? Math.round(max / m - (0.5 - Number.EPSILON)) : undefined,
          })
          .map((v) => v * m)
      }
      return gen.double({ min: type.options?.minimum?.[0], max: type.options?.maximum?.[0] }).filter
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
    .with({ kind: 'optional' }, (type) =>
      maxDepth <= 1
        ? gen.constant(undefined)
        : gen.oneof(gen.constant(undefined), getArbitrary(type.wrappedType, maxDepth - 1)),
    )
    .with({ kind: 'nullable' }, (type) =>
      maxDepth <= 1 ? gen.constant(null) : gen.oneof(gen.constant(null), getArbitrary(type.wrappedType, maxDepth - 1)),
    )
    .with({ kind: 'union' }, (type) =>
      gen.oneof(...Object.values(type.variants).map((v) => getArbitrary(v as Type, maxDepth - 1))),
    )
    .with({ kind: 'object' }, (type) =>
      gen.record(
        Object.fromEntries(Object.entries(type.types).map(([k, st]) => [k, getArbitrary(st as Type, maxDepth - 1)])),
      ),
    )
    .with({ kind: 'array' }, (type) =>
      gen.array(getArbitrary(type.wrappedType, maxDepth - 1), {
        maxLength: type.options?.maxItems,
        minLength: type.options?.minItems,
      }),
    )
    .with({ kind: 'reference' }, (type) => getArbitrary(type.wrappedType, maxDepth - 1))
    .with({ kind: 'custom' }, (type) => type.arbitrary)
    .exhaustive()

  return value as gen.Arbitrary<Infer<T>>
}
