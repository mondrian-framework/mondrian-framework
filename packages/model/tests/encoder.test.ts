import { encoder, arbitrary, types, validator } from '../src'
import { assertOk } from './testing-utils'
import { test } from '@fast-check/vitest'
import gen from 'fast-check'
import { describe, expect, vi } from 'vitest'

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
  test.prop([arbitrary.number(), number])('encodes a number value as itself', (model, number) => {
    expect(encoder.encodeWithoutValidation(model, number)).toEqual(number)
  })

  test.prop([arbitrary.boolean(), gen.boolean()])('encodes a boolean value as itself', (model, boolean) => {
    expect(encoder.encodeWithoutValidation(model, boolean)).toEqual(boolean)
  })

  test.prop([arbitrary.string(), gen.string()])('encodes a string value as itself', (model, string) => {
    expect(encoder.encodeWithoutValidation(model, string)).toEqual(string)
  })

  test.prop([arbitrary.enumeration(nonEmptyStringArray)])("encodes an enum's variant as a string", (model) => {
    model.variants.forEach((variant) => expect(encoder.encodeWithoutValidation(model, variant)).toEqual(variant))
  })

  test.prop([arbitrary.literal(literalValue)])('encodes a literal value as itself', (model) => {
    expect(encoder.encodeWithoutValidation(model, model.literalValue)).toEqual(model.literalValue)
  })

  test.prop([arbitrary.nullable(arbitrary.number()), number])('encodes a nullable value as itself', (model, number) => {
    expect(encoder.encodeWithoutValidation(model, number)).toEqual(number)
  })

  test.prop([arbitrary.nullable(arbitrary.number())])('encodes a nullable null value as null', (model) => {
    expect(encoder.encodeWithoutValidation(model, null)).toEqual(null)
  })

  test.prop([arbitrary.optional(arbitrary.number()), number])(
    'encodes an optional value as itself',
    (model, number) => {
      expect(encoder.encodeWithoutValidation(model, number)).toEqual(number)
    },
  )

  test.prop([arbitrary.optional(arbitrary.number())])('encodes an optional missing value as null', (model) => {
    expect(encoder.encodeWithoutValidation(model, undefined)).toEqual(null)
  })

  test.prop([arbitrary.reference(arbitrary.number()), number])(
    'encodes a reference value as itself',
    (model, number) => {
      expect(encoder.encodeWithoutValidation(model, number)).toEqual(number)
    },
  )

  const objectModel = arbitrary.object({ age: arbitrary.number(), name: arbitrary.optional(arbitrary.string()) })
  const objectGenerator = gen.record({ age: number, name: gen.string() })
  test.prop([objectModel, objectGenerator])('encodes the fields of an object', (model, object) => {
    expect(encoder.encodeWithoutValidation(model, object)).toEqual(object)
  })

  test.prop([objectModel])('drops undefined fields when encoding object', (model) => {
    expect(encoder.encodeWithoutValidation(model, { age: 1 })).toEqual({ age: 1 })
    expect(encoder.encodeWithoutValidation(model, { age: 1, name: undefined })).toEqual({ age: 1 })
  })

  test.prop([arbitrary.array(arbitrary.number()), gen.array(number)])(
    'encodes the elements of an array',
    (model, array) => {
      expect(encoder.encodeWithoutValidation(model, array)).toEqual(array)
    },
  )

  const unionChecks = {
    variant1: (value: number | string) => typeof value === 'number',
    variant2: (value: number | string) => typeof value === 'string',
  }
  type UnionFields = { variant1: types.NumberType; variant2: types.StringType }
  const unionFields = { variant1: arbitrary.number(), variant2: arbitrary.string() }
  const unionModel = arbitrary.union<UnionFields>(unionFields, unionChecks)
  const unionGenerator = gen.oneof(number, gen.string())
  test.prop([unionModel, unionGenerator])('encodes a union variant as itself', (model, variant) => {
    expect(encoder.encodeWithoutValidation(model, variant)).toEqual(variant)
  })

  test('fails when called on something that is not a variant of an enum', () => {
    const model = types.union({ variant: types.number }, { variant: () => false })
    expect(() => encoder.encodeWithoutValidation(model, 1)).toThrowError()
  })

  test.prop([gen.anything().filter((value) => value !== undefined)])('encodes a custom type', (value) => {
    const customOptions = { foo: 1, bar: 2 }
    const mocks = {
      encode: (value: any, options: any) => {
        expect(options).toBe(customOptions)
        return value
      },
      decode: () => {
        throw 'test'
      },
      validate: () => {
        throw 'test'
      },
    }

    const encodeSpy = vi.spyOn(mocks, 'encode')
    const model = types.custom('test', mocks.encode, mocks.decode, mocks.validate, customOptions)
    expect(encoder.encodeWithoutValidation(model, value)).toEqual(value)
    expect(encodeSpy).toHaveBeenCalledTimes(1)
  })

  test('fails with internal error on unhandled type kind', () => {
    expect(() => encoder.encodeWithoutValidation({ kind: 'not a type' } as any, 1)).toThrowError(
      /.*\[internal error\].*/,
    )
  })
})

describe('encoder.encode', () => {
  test.prop([gen.anything()])('performs validation', (value) => {
    const options = { foo: 'bar', baz: 1 }
    const validationOptions = { errorReportingStrategy: 'allErrors' } as const
    const mocks = {
      encode: (innerValue: any, innerOptions: any) => {
        expect(innerOptions).toEqual(options)
        return innerValue
      },
      decode: () => {
        throw 'test'
      },
      validate: (innerValue: any, innerValidationOptions: any, innerOptions: any) => {
        expect(innerValue).toEqual(value)
        expect(innerValidationOptions).toEqual(validationOptions)
        expect(innerOptions).toEqual(options)
        return validator.succeed()
      },
    }
    const validateSpy = vi.spyOn(mocks, 'validate')
    const encodeSpy = vi.spyOn(mocks, 'encode')
    const model = types.custom('test', mocks.encode, mocks.decode, mocks.validate, options)
    assertOk(encoder.encode(model, value, validationOptions))
    expect(validateSpy).toBeCalledTimes(1)
    expect(encodeSpy).toBeCalledTimes(1)
  })

  test('fails with internal error on unhandled type kind', () => {
    expect(() => encoder.encode({ kind: 'not a type' } as any, 1)).toThrowError(/.*\[internal error\].*/)
  })
})
