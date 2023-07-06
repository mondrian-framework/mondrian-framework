import { fc as gen } from '@fast-check/vitest'

export function nonEmptyArray<T>(generator: gen.Arbitrary<T>): gen.Arbitrary<[T, ...T[]]> {
  return generator.chain((head) => gen.array(generator).map((tail) => [head, ...tail]))
}
