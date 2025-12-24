import { model } from '../../src'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

//TODO [Good first issue]: test other types constructor

describe('type contructor', () => {
  test('object invalid fields', () => {
    expect(() => model.object({ constructor: model.string() })).toThrowError(
      'Forbidden field name on object: "constructor"',
    )

    expect(() => model.object(Object.fromEntries([['__proto__', model.string()]]))).toThrowError(
      'Forbidden field name on object: "__proto__"',
    )

    expect(() => model.object(Object.fromEntries([['', model.string()]]))).toThrowError(
      'Forbidden field name on object: ""',
    )
  })

  test('number invalid options', () => {
    expect(() => model.integer({ exclusiveMinimum: 1, exclusiveMaximum: 2 })).toThrowError(
      'If both lower bound and upper bound are enabled on integer types the minimum difference between the two bounds must be greater than 1',
    )
    expect(() => model.integer({ minimum: 1, maximum: 0.99 })).toThrowError()
    expect(() => model.integer({ minimum: 1, exclusiveMaximum: 1 })).toThrowError()
    expect(() => model.integer({ exclusiveMinimum: 1, maximum: 1 })).toThrowError()
    expect(model.integer({ exclusiveMinimum: 0.5, minimum: 1, maximum: 1 })).toBeTruthy()
    expect(() => model.integer({ minimum: 1, maximum: 1.99 })).toThrowError()
    expect(() => model.number({ minimum: Number.NaN })).toThrow()
    expect(() => model.number({ maximum: Number.NaN })).toThrow()
    expect(() => model.number({ exclusiveMinimum: Number.NaN })).toThrow()
    expect(() => model.number({ exclusiveMaximum: Number.NaN })).toThrow()
    expect(() => model.number({ minimum: Number.POSITIVE_INFINITY })).toThrow()
    expect(() => model.number({ maximum: Number.POSITIVE_INFINITY })).toThrow()
    expect(() => model.number({ exclusiveMinimum: Number.POSITIVE_INFINITY })).toThrow()
    expect(() => model.number({ exclusiveMaximum: Number.POSITIVE_INFINITY })).toThrow()
  })

  test('string invalid options', () => {
    // minLength > maxLength should throw
    expect(() => model.string({ minLength: 10, maxLength: 5 })).toThrowError(
      "String type's minimum length (10) should be lower than its maximum length 5",
    )

    // Non-integer minLength should throw
    expect(() => model.string({ minLength: 1.5 })).toThrowError('The minimum length (1.5) must be an integer')

    // Non-integer maxLength should throw
    expect(() => model.string({ maxLength: 2.5 })).toThrowError('The maximum length (2.5) must be an integer')

    // Negative minLength should throw
    expect(() => model.string({ minLength: -1 })).toThrowError('The minimum length (-1) cannot be negative')

    // Negative maxLength should throw
    expect(() => model.string({ maxLength: -1 })).toThrowError('The maximum length (-1) cannot be negative')
  })

  test('string arbitrary with regex and min/max length throws', () => {
    const stringWithRegexAndLength = model.string({ regex: /test/, minLength: 1 })
    expect(() => stringWithRegexAndLength.arbitrary()).toThrow(
      'I cannot generate values from string types that have both a regex and min/max length defined',
    )

    const stringWithRegexAndMaxLength = model.string({ regex: /test/, maxLength: 10 })
    expect(() => stringWithRegexAndMaxLength.arbitrary()).toThrow(
      'I cannot generate values from string types that have both a regex and min/max length defined',
    )
  })
})

describe('BaseType methods', () => {
  test('arbitrary throws at very low depth (recursive detection)', () => {
    // Create a recursive type that would hit the depth limit
    type Node = { value: number; children?: Node[] }
    const nodeType: model.Type = model.object({
      value: model.number(),
      children: () => model.array(nodeType).optional(),
    })

    // This should throw when depth gets too low
    expect(() => model.concretise(nodeType).arbitrary(-25)).toThrow(
      'Impossible to generate an arbitrary value with the given max depth',
    )
  })

  test('encodeWithoutValidation hides sensitive data', () => {
    const sensitiveString = model.string().sensitive()
    const encoded = sensitiveString.encodeWithoutValidation('secret', { sensitiveInformationStrategy: 'hide' })
    expect(encoded).toBe(null)
  })

  test('encodeWithoutValidation shows sensitive data by default', () => {
    const sensitiveString = model.string().sensitive()
    const encoded = sensitiveString.encodeWithoutValidation('secret')
    expect(encoded).toBe('secret')
  })

  test('decodeWithoutValidation uses defaultDecodeValue', () => {
    const stringWithDefault = model.string({ defaultDecodeValue: 'default' })
    const result = stringWithDefault.decodeWithoutValidation(undefined)
    expect(result.isOk && result.value).toBe('default')
  })

  test('example generates value with seed', () => {
    const numberType = model.number()
    const example1 = numberType.example({ seed: 12345 })
    const example2 = numberType.example({ seed: 12345 })
    expect(example1).toBe(example2) // Same seed should produce same result
  })

  test('example generates value with maxDepth', () => {
    const objType = model.object({ value: model.number() })
    const example = objType.example({ maxDepth: 2 })
    expect(example).toHaveProperty('value')
    expect(typeof example.value).toBe('number')
  })

  test('optional method creates optional type', () => {
    const stringType = model.string()
    const optionalString = stringType.optional()
    expect(model.isOptional(optionalString)).toBe(true)
  })

  test('nullable method creates nullable type', () => {
    const stringType = model.string()
    const nullableString = stringType.nullable()
    expect(model.isNullable(nullableString)).toBe(true)
  })

  test('array method creates array type', () => {
    const stringType = model.string()
    const arrayString = stringType.array()
    expect(model.isArray(arrayString)).toBe(true)
  })

  test('equals method compares types', () => {
    const string1 = model.string()
    const string2 = model.string()
    const number1 = model.number()
    expect(string1.equals(string2)).toBe(true)
    expect(string1.equals(number1)).toBe(false)
  })

  test('setOptions creates new type with options', () => {
    const stringType = model.string()
    const stringWithOptions = stringType.setOptions({ minLength: 5 })
    expect(stringWithOptions.options?.minLength).toBe(5)
  })

  test('updateOptions merges with existing options', () => {
    const stringType = model.string({ minLength: 1 })
    const updatedString = stringType.updateOptions({ maxLength: 10 })
    expect(updatedString.options?.minLength).toBe(1)
    expect(updatedString.options?.maxLength).toBe(10)
  })

  test('setName sets the name option', () => {
    const stringType = model.string()
    const namedString = stringType.setName('myString')
    expect(namedString.options?.name).toBe('myString')
  })

  test('sensitive marks type as sensitive', () => {
    const stringType = model.string()
    const sensitiveString = stringType.sensitive()
    expect(sensitiveString.options?.sensitive).toBe(true)
  })
})

describe('datetime constructor', () => {
  test('throws when minimum > maximum', () => {
    const min = new Date('2024-12-31')
    const max = new Date('2024-01-01')
    expect(() => model.datetime({ minimum: min, maximum: max })).toThrow('Minimum date cannot be after maximum date.')
  })
})
