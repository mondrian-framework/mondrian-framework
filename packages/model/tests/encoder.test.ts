import { arbitrary, types, validation } from '../src'
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

describe.concurrent('encoder.encodeWithoutValidation', () => {
  test.prop([arbitrary.number(), number])('encodes a number value as itself', (model, number) => {
    expect(model.encodeWithoutValidation(number)).toEqual(number)
  })

  test.prop([arbitrary.boolean(), gen.boolean()])('encodes a boolean value as itself', (model, boolean) => {
    expect(model.encodeWithoutValidation(boolean)).toEqual(boolean)
  })

  test.prop([arbitrary.string(), gen.string()])('encodes a string value as itself', (model, string) => {
    expect(model.encodeWithoutValidation(string)).toEqual(string)
  })

  test.prop([arbitrary.enumeration(nonEmptyStringArray)])("encodes an enum's variant as a string", (model) => {
    model.variants.forEach((variant) => expect(model.encodeWithoutValidation(variant)).toEqual(variant))
  })

  test.prop([arbitrary.literal(literalValue)])('encodes a literal value as itself', (model) => {
    expect(model.encodeWithoutValidation(model.literalValue)).toEqual(model.literalValue)
  })

  test.prop([arbitrary.dateTime(), gen.date()])('encodes a datetime value as iso string', (model, date) => {
    expect(model.encodeWithoutValidation(date)).toEqual(date.toISOString())
  })

  test.prop([arbitrary.timestamp(), gen.date()])('encodes a timestamp value as unix time', (model, date) => {
    expect(model.encodeWithoutValidation(date)).toEqual(date.getTime())
  })

  test.prop([gen.anything()])('encodes a unknown value as JSON', (anything) => {
    expect(types.unknown().encodeWithoutValidation(anything)).toEqual(
      anything === undefined ? null : JSON.parse(JSON.stringify(anything)),
    )
  })

  test.prop([gen.anything()])('encodes a never value as JSON', (anything) => {
    expect(() => types.never().encodeWithoutValidation(anything as never)).toThrowError()
  })

  test.prop([arbitrary.nullable(arbitrary.number()), number])('encodes a nullable value as itself', (model, number) => {
    expect(model.encodeWithoutValidation(number)).toEqual(number)
  })

  test.prop([arbitrary.nullable(arbitrary.number())])('encodes a nullable null value as null', (model) => {
    expect(model.encodeWithoutValidation(null)).toEqual(null)
  })

  test.prop([arbitrary.optional(arbitrary.number()), number])(
    'encodes an optional value as itself',
    (model, number) => {
      expect(model.encodeWithoutValidation(number)).toEqual(number)
    },
  )

  test.prop([arbitrary.optional(arbitrary.number())])('encodes an optional missing value as null', (model) => {
    expect(model.encodeWithoutValidation(undefined)).toEqual(null)
  })

  const objectModel = arbitrary.object({ age: arbitrary.number(), name: arbitrary.optional(arbitrary.string()) })
  const objectGenerator = gen.record({ age: number, name: gen.string() })
  test.prop([objectModel, objectGenerator])('encodes the fields of an object', (model, object) => {
    expect(types.concretise(model).immutable().encodeWithoutValidation(object)).toEqual(object)
    expect(types.concretise(model).mutable().encodeWithoutValidation(object)).toEqual(object)
  })

  test.prop([objectModel])('drops undefined fields when encoding object', (model) => {
    expect(types.concretise(model).mutable().encodeWithoutValidation({ age: 1 })).toEqual({ age: 1 })
    expect(types.concretise(model).immutable().encodeWithoutValidation({ age: 1 })).toEqual({ age: 1 })
    expect(types.concretise(model).mutable().encodeWithoutValidation({ age: 1, name: undefined })).toEqual({ age: 1 })
    expect(types.concretise(model).immutable().encodeWithoutValidation({ age: 1, name: undefined })).toEqual({ age: 1 })
  })

  test.prop([arbitrary.array(arbitrary.number()), gen.array(number)])(
    'encodes the elements of an array',
    (model, array) => {
      expect(model.mutable().encodeWithoutValidation(array)).toEqual(array)
      expect(model.immutable().encodeWithoutValidation(array)).toEqual(array)
    },
  )

  describe.concurrent('on union values', () => {
    const unionModel = arbitrary.union({
      variant1: arbitrary.number(),
      variant2: arbitrary.optional(arbitrary.string()),
    })

    test.prop([unionModel, gen.double()])('encodes a variant', (model, number) => {
      expect(model.encodeWithoutValidation(number)).toEqual(number)
    })

    test.prop([unionModel, gen.string()])('encodes the other variant', (model, string) => {
      expect(model.encodeWithoutValidation(string)).toEqual(string)
    })

    test.prop([unionModel])('encodes a variant with only optional undefined field', (model) => {
      expect(model.encodeWithoutValidation(undefined)).toEqual(null)
    })

    test.prop([unionModel])('fails if called with unhandled variant', (model) => {
      expect(() => model.encodeWithoutValidation(true as any)).toThrowError(/^\[internal error\]/)
      expect(() => model.encodeWithoutValidation({} as any)).toThrowError(/^\[internal error\]/)
    })
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
      arbitrary: () => {
        throw 'test'
      },
    }

    const encodeSpy = vi.spyOn(mocks, 'encode')
    const model = types.custom('test', mocks.encode, mocks.decode, mocks.validate, mocks.arbitrary, customOptions)
    expect(model.encodeWithoutValidation(value)).toEqual(value)
    expect(encodeSpy).toHaveBeenCalledTimes(1)
  })

  test.prop([arbitrary.typeAndValue()])('hides sensitive data', ([model, value]) => {
    const result = types
      .concretise(model)
      .sensitive()
      .encodeWithoutValidation(value, { sensitiveInformationStrategy: 'hide' })
    expect(result).toEqual(null)
  })
})

describe.concurrent('encoder.encode', () => {
  test.prop([arbitrary.typeAndValue()])('hides sensitive data', ([model, value]) => {
    const result = types.concretise(model).sensitive().encode(value, { sensitiveInformationStrategy: 'hide' })
    expect(assertOk(result)).toEqual(null)
  })

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
        return validation.succeed()
      },
      arbitrary: () => {
        throw 'test'
      },
    }
    const validateSpy = vi.spyOn(mocks, 'validate')
    const encodeSpy = vi.spyOn(mocks, 'encode')
    const model = types.custom('test', mocks.encode, mocks.decode, mocks.validate, mocks.arbitrary, options)
    assertOk(model.encode(value, undefined, validationOptions))
    expect(validateSpy).toBeCalledTimes(1)
    expect(encodeSpy).toBeCalledTimes(1)
  })
})
