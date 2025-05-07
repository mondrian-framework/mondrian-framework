import { assertApiValidity, objectToZodShape } from '../src/utils'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

describe('utils', () => {
  // Set up a test module for validating API specs
  const testFunc = functions
    .define({
      input: model.string(),
      output: model.string(),
    })
    .implement({
      async body({ input }) {
        return result.ok(`Echo: ${input}`)
      },
    })

  const testModule = module.build({
    functions: { testFunc },
    name: 'test-module',
  })

  describe('assertApiValidity', () => {
    test('accepts valid API configuration', () => {
      const validApi = {
        module: testModule,
        functions: {
          testFunc: { name: 'test', description: 'Test function' },
        },
      }

      expect(() => assertApiValidity(validApi as any)).not.toThrow()
    })

    test('accepts valid API configuration with array of specs', () => {
      const validApi = {
        module: testModule,
        functions: {
          testFunc: [
            { name: 'test1', description: 'Test function 1' },
            { name: 'test2', description: 'Test function 2' },
          ],
        },
      }

      expect(() => assertApiValidity(validApi as any)).not.toThrow()
    })

    test('throws error for empty name in function spec', () => {
      const invalidApi = {
        module: testModule,
        functions: {
          testFunc: { name: '', description: 'Test function' },
        },
      }

      expect(() => assertApiValidity(invalidApi as any)).toThrow(
        "Function 'testFunc' has an invalid MCP specification: 'name' cannot be empty.",
      )
    })

    test('throws error for whitespace-only name in function spec', () => {
      const invalidApi = {
        module: testModule,
        functions: {
          testFunc: { name: '   ', description: 'Test function' },
        },
      }

      expect(() => assertApiValidity(invalidApi as any)).toThrow(
        "Function 'testFunc' has an invalid MCP specification: 'name' cannot be empty.",
      )
    })
  })

  describe('objectToZodShape', () => {
    test('converts simple object type to zod shape', () => {
      const simpleType = model.object({
        string: model.string(),
        number: model.number(),
        boolean: model.boolean(),
      })

      const zodShape = objectToZodShape(simpleType)

      expect(zodShape).toBeDefined()
      expect(zodShape.string instanceof z.ZodType).toBe(true)
      expect(zodShape.number instanceof z.ZodType).toBe(true)
      expect(zodShape.boolean instanceof z.ZodType).toBe(true)
    })

    test('handles nested object types', () => {
      const nestedType = model.object({
        name: model.string(),
        details: model.object({
          age: model.number(),
          active: model.boolean(),
        }),
      })

      const zodShape = objectToZodShape(nestedType)

      expect(zodShape).toBeDefined()
      expect(zodShape.name instanceof z.ZodType).toBe(true)
      expect(zodShape.details instanceof z.ZodType).toBe(true)
    })

    test('handles array types', () => {
      const arrayType = model.object({
        items: model.array(model.string()),
      })

      const zodShape = objectToZodShape(arrayType)

      expect(zodShape).toBeDefined()
      expect(zodShape.items instanceof z.ZodType).toBe(true)
    })

    test('handles optional types', () => {
      const optionalType = model.object({
        required: model.string(),
        optional: model.optional(model.string()),
      })

      const zodShape = objectToZodShape(optionalType)

      expect(zodShape).toBeDefined()
      expect(zodShape.required instanceof z.ZodType).toBe(true)
      expect(zodShape.optional instanceof z.ZodType).toBe(true)
    })

    test('handles function returning object type', () => {
      const typeFunction = () =>
        model.object({
          name: model.string(),
          value: model.number(),
        })

      const zodShape = objectToZodShape(typeFunction)

      expect(zodShape).toBeDefined()
      expect(zodShape.name instanceof z.ZodType).toBe(true)
      expect(zodShape.value instanceof z.ZodType).toBe(true)
    })

    // Tests for all Mondrian type conversions
    test('handles string type with constraints', () => {
      const stringWithOptions = model.string({
        minLength: 3,
        maxLength: 10,
        regex: /^[a-z]+$/,
        description: 'A string field',
      })

      // Convert to Zod via an object wrapper
      const objType = model.object({ field: stringWithOptions })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles number type with constraints', () => {
      const numberWithOptions = model.number({
        isInteger: true,
        minimum: 0,
        maximum: 100,
        description: 'A number field',
      })

      const objType = model.object({ field: numberWithOptions })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles boolean type', () => {
      const booleanWithDesc = model.boolean({ description: 'A boolean field' })

      const objType = model.object({ field: booleanWithDesc })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles nullable type', () => {
      const nullableString = model.nullable(model.string(), { description: 'A nullable string' })

      const objType = model.object({ field: nullableString })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles enum type', () => {
      const enumType = model.union(
        {
          a: model.literal('a'),
          b: model.literal('b'),
          c: model.literal('c'),
        },
        { description: 'An enum field' },
      )

      const objType = model.object({ field: enumType })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles literal type', () => {
      const literalType = model.literal('specific', { description: 'A literal field' })

      const objType = model.object({ field: literalType })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles union type', () => {
      const unionType = model.union(
        {
          string: model.string(),
          number: model.number(),
        },
        { description: 'A union field' },
      )

      const objType = model.object({ field: unionType })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles record type', () => {
      const recordType = model.object(
        {
          key1: model.string(),
          key2: model.number(),
        },
        { description: 'A record field' },
      )

      const objType = model.object({ field: recordType })
      const zodShape = objectToZodShape(objType)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })

    test('handles otherwise (any) type', () => {
      // For testing purposes, we'll create a custom type that doesn't match any of the known types
      const anyType = { kind: 'unknown', options: { description: 'An unknown type' } }

      // We need to modify our test to handle this special case
      const objType = model.object({
        field: model.string(), // Add a standard field first
      })

      // Replace the field with our custom type after creation
      // This is a bit of a hack for testing purposes
      const customObj = {
        ...objType,
        fields: { ...objType.fields, field: anyType },
      }

      // Now objectToZodShape should handle this with the 'otherwise' case
      const zodShape = objectToZodShape(customObj as any)

      expect(zodShape.field instanceof z.ZodType).toBe(true)
    })
  })
})
