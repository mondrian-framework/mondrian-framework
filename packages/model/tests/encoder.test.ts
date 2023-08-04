import { encoder, arbitrary } from '../src'
import { test } from '@fast-check/vitest'
import gen from 'fast-check'
import { describe, expect } from 'vitest'

const number = gen.oneof(gen.integer(), gen.float())

const nonEmptyStringArray: gen.Arbitrary<readonly [string, ...string[]]> = gen.string().chain((first) => {
  return gen.array(gen.string()).map((rest) => {
    return [first, ...rest]
  })
})

const literalValue: gen.Arbitrary<boolean | string | number | null> = gen.oneof(
  gen.boolean(),
  gen.constant(null),
  gen.string(),
  number,
)

describe('encoder.encodeWithoutValidation', () => {
  test.prop([arbitrary.number(), number])('can encode a number type as a number', (model, number) => {
    expect(encoder.encodeWithoutValidation(model, number)).toEqual(number)
  })

  test.prop([arbitrary.boolean(), gen.boolean()])('can encode a boolean type as a boolean', (model, boolean) => {
    expect(encoder.encodeWithoutValidation(model, boolean)).toEqual(boolean)
  })

  test.prop([arbitrary.string(), gen.string()])('can encode a string type as a string', (model, string) => {
    expect(encoder.encodeWithoutValidation(model, string)).toEqual(string)
  })

  test.prop([arbitrary.enumeration(nonEmptyStringArray)])("can encode an enum's variants as strings", (model) => {
    model.variants.forEach((variant) => expect(encoder.encodeWithoutValidation(model, variant)).toEqual(variant))
  })

  test.prop([arbitrary.literal(literalValue)])('can encode a literal value', (model) => {
    expect(encoder.encodeWithoutValidation(model, model.literalValue)).toEqual(model.literalValue)
  })
})

describe('encoder.encode', () => {
  test('performs validation', () => {})
})
