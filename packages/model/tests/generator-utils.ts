import m from '../src'
import { fc as gen } from '@fast-check/vitest'

export function nonEmptyArray<T>(generator: gen.Arbitrary<T>): gen.Arbitrary<[T, ...T[]]> {
  return generator.chain((head) => gen.array(generator).map((tail) => [head, ...tail]))
}

/**
 * Turns an object type into the type of a generator for that object.
 *
 * ## Examples
 *
 * ```ts
 * type Gs = OptionsToGenerator<{ name: string, age: number }>
 * // -> Gs = { name: Arbitrary<string>, age: Arbitrary<number> }
 * ```
 *
 */
type OptionsToGenerator<Options> = {
  [Key in keyof Options]: gen.Arbitrary<Options[Key]>
}

/**
 * Turns any `Type` that has an `opts?` field into the type for a generator
 * for those options.
 *
 * ## Examples
 *
 * ```ts
 * type Gs = TypeToOptionsGenerator<{ opts?: { name: string, age?: number } }>
 * // -> Gs = {
 *   name: gen.Arbitrary<string>;
 *   age?: gen.Arbitrary<number | undefined>;
 * }
 * ```
 */
type TypeToOptionsGenerator<Type extends { opts?: any }> = OptionsToGenerator<Exclude<Type['opts'], undefined>>

/**
 * @param opts options to override the default generators
 * @returns an `Arbitrary` that can generate basic options for Mondrian types
 */
export function baseOptions(
  opts?: OptionsToGenerator<{ name?: string; description?: string }>,
): gen.Arbitrary<{ name?: string; description?: string }> {
  const generators =
    opts != undefined
      ? opts
      : {
          name: gen.string(),
          description: gen.string(),
        }
  return gen.record(generators, { requiredKeys: [] })
}

/**
 * @param opts options to override the default generators
 * @returns an `Arbitrary` that can generate options for a `StringType`
 */
export function stringOptions(opts?: TypeToOptionsGenerator<m.StringType>): gen.Arbitrary<m.StringType['opts']> {
  const generators =
    opts != undefined
      ? opts
      : {
          name: gen.string(),
          description: gen.string(),
          maxLength: gen.integer(),
          minLength: gen.integer(),
          regex: gen.constant(/.*/),
        }

  return gen.record(generators, { requiredKeys: [] })
}

/**
 * @param opts options to override the default generators
 * @returns an `Arbitrary` that can generate `StringType`s
 */
export function stringGenerator(
  opts?: TypeToOptionsGenerator<m.StringType>,
): gen.Arbitrary<m.StringType & m.DecoratorShorcuts<m.StringType>> {
  return stringOptions(opts).map(m.string)
}

/**
 * @param opts options to override the default generators
 * @returns an `Arbitrary` that can generate options for a `NumberType`
 */
export function numberOptions(opts?: TypeToOptionsGenerator<m.NumberType>): gen.Arbitrary<m.NumberType['opts']> {
  const generators =
    opts != undefined
      ? opts
      : {
          name: gen.string(),
          description: gen.string(),
          maximum: gen.integer(),
          minimum: gen.integer(),
          exclusiveMaximum: gen.integer(),
          exclusiveMinimum: gen.integer(),
          multipleOf: gen.integer().filter((n) => n > 0),
        }

  return gen.record(generators, { requiredKeys: [] })
}

/**
 * @param opts options to override the default generators
 * @returns an `Arbitrary` that can generate `NumberType`s
 */
export function numberGenerator(
  opts?: TypeToOptionsGenerator<m.NumberType>,
): gen.Arbitrary<m.NumberType & m.DecoratorShorcuts<m.NumberType>> {
  return numberOptions(opts).map(m.number)
}

/**
 * @param opts options to override the default generators
 * @returns an `Arbitrary` that can generate options for an `ArrayDecorator`
 */
export function arrayOptions(opts?: TypeToOptionsGenerator<m.ArrayDecorator>): gen.Arbitrary<m.ArrayDecorator['opts']> {
  const generators =
    opts != undefined
      ? opts
      : {
          name: gen.string(),
          description: gen.string(),
          maxItems: gen.integer(),
        }

  return gen.record(generators, { requiredKeys: [] })
}
