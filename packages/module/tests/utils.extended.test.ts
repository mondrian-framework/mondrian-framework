import { utils, functions, error } from '../src'
import { model, result, decoding } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('utils', () => {
  describe('uniqueTypes', () => {
    test('should gather types from scalar types', () => {
      const stringType = model.string()
      const types = utils.uniqueTypes(stringType)

      expect(types.has(stringType)).toBe(true)
      expect(types.size).toBe(1)
    })

    test('should gather types from wrapper types', () => {
      const stringType = model.string()
      const optionalType = stringType.optional()
      const types = utils.uniqueTypes(optionalType)

      expect(types.has(stringType)).toBe(true)
      expect(types.has(optionalType)).toBe(true)
      expect(types.size).toBe(2)
    })

    test('should gather types from nested objects', () => {
      const nameType = model.string()
      const ageType = model.number()
      const objectType = model.object({ name: nameType, age: ageType })
      const types = utils.uniqueTypes(objectType)

      expect(types.has(nameType)).toBe(true)
      expect(types.has(ageType)).toBe(true)
      expect(types.has(objectType)).toBe(true)
      expect(types.size).toBe(3)
    })

    test('should handle recursive types without infinite loop', () => {
      const recursiveType = (): model.ObjectType<any, any> =>
        model.object({ value: model.string(), child: model.optional(recursiveType) })
      const types = utils.uniqueTypes(recursiveType)

      expect(types.has(recursiveType)).toBe(true)
      expect(types.size).toBeGreaterThan(1)
    })

    test('should gather types from union types', () => {
      const stringVariant = model.string()
      const numberVariant = model.number()
      const unionType = model.union({ str: stringVariant, num: numberVariant })
      const types = utils.uniqueTypes(unionType)

      expect(types.has(stringVariant)).toBe(true)
      expect(types.has(numberVariant)).toBe(true)
      expect(types.has(unionType)).toBe(true)
    })

    test('should gather types from entity types', () => {
      const idType = model.number()
      const nameType = model.string()
      const entityType = model.entity({ id: idType, name: nameType })
      const types = utils.uniqueTypes(entityType)

      expect(types.has(idType)).toBe(true)
      expect(types.has(nameType)).toBe(true)
      expect(types.has(entityType)).toBe(true)
    })
  })

  describe('allUniqueTypes', () => {
    test('should gather types from multiple input types', () => {
      const type1 = model.string()
      const type2 = model.number()
      const type3 = model.boolean()
      const types = utils.allUniqueTypes([type1, type2, type3])

      expect(types.has(type1)).toBe(true)
      expect(types.has(type2)).toBe(true)
      expect(types.has(type3)).toBe(true)
      expect(types.size).toBe(3)
    })

    test('should deduplicate shared types', () => {
      const sharedType = model.string()
      const obj1 = model.object({ name: sharedType })
      const obj2 = model.object({ title: sharedType })
      const types = utils.allUniqueTypes([obj1, obj2])

      // sharedType should only appear once
      let sharedCount = 0
      types.forEach((t) => {
        if (t === sharedType) sharedCount++
      })
      expect(sharedCount).toBe(1)
    })

    test('should handle empty array', () => {
      const types = utils.allUniqueTypes([])
      expect(types.size).toBe(0)
    })

    test('should handle double-wrapped functions', () => {
      // When type is () => () => actualType, allUniqueTypes resolves the wrappers
      const innerType = model.string()
      const wrappedOnce = () => innerType
      const wrappedTwice = () => wrappedOnce

      const types = utils.allUniqueTypes([wrappedTwice])
      // The function should be included and resolved
      expect(types.size).toBeGreaterThan(0)
    })
  })

  describe('decodeFunctionFailure', () => {
    test('should successfully decode valid error', () => {
      const errors = { notFound: model.string(), invalid: model.number() }
      const failure = { notFound: 'Resource not found' }

      const result = utils.decodeFunctionFailure(failure, errors)

      expect(result.isOk).toBe(true)
    })

    test('should fail on empty object', () => {
      const errors = { notFound: model.string() }
      const failure = {}

      const result = utils.decodeFunctionFailure(failure, errors)

      expect(result.isFailure).toBe(true)
    })

    test('should fail on invalid error type', () => {
      const errors = { notFound: model.string() }
      const failure = { notFound: 123 } // should be string

      const result = utils.decodeFunctionFailure(failure, errors, {
        errorReportingStrategy: 'allErrors',
        fieldStrictness: 'expectExactFields',
      })

      expect(result.isFailure).toBe(true)
    })

    test('should handle multiple errors', () => {
      const errors = {
        notFound: model.string(),
        unauthorized: model.object({ reason: model.string() }),
      }
      const failure = { notFound: 'Not found', unauthorized: { reason: 'No access' } }

      const result = utils.decodeFunctionFailure(failure, errors)

      expect(result.isOk).toBe(true)
    })
  })

  describe('reservedProvidersNames', () => {
    test('should contain expected reserved names', () => {
      expect(utils.reservedProvidersNames).toContain('input')
      expect(utils.reservedProvidersNames).toContain('retrieve')
      expect(utils.reservedProvidersNames).toContain('logger')
      expect(utils.reservedProvidersNames).toContain('tracer')
      expect(utils.reservedProvidersNames).toContain('functionName')
    })
  })

  describe('hasNestedPromises', () => {
    test('should return true for Promise values', () => {
      expect(utils.hasNestedPromises(Promise.resolve(1))).toBe(true)
    })

    test('should return false for non-Promise values', () => {
      expect(utils.hasNestedPromises(1)).toBe(false)
      expect(utils.hasNestedPromises('string')).toBe(false)
      expect(utils.hasNestedPromises(null)).toBe(false)
      expect(utils.hasNestedPromises(undefined)).toBe(false)
    })

    test('should detect promises in arrays', () => {
      expect(utils.hasNestedPromises([1, 2, Promise.resolve(3)])).toBe(true)
      expect(utils.hasNestedPromises([1, 2, 3])).toBe(false)
    })

    test('should detect promises in objects', () => {
      expect(utils.hasNestedPromises({ a: 1, b: Promise.resolve(2) })).toBe(true)
      expect(utils.hasNestedPromises({ a: 1, b: 2 })).toBe(false)
    })

    test('should detect deeply nested promises', () => {
      expect(utils.hasNestedPromises({ a: { b: { c: Promise.resolve(1) } } })).toBe(true)
      expect(utils.hasNestedPromises([[[[Promise.resolve(1)]]]])).toBe(true)
    })

    test('should handle empty structures', () => {
      expect(utils.hasNestedPromises({})).toBe(false)
      expect(utils.hasNestedPromises([])).toBe(false)
    })
  })

  describe('reolsveNestedPromises', () => {
    test('should resolve top-level promises', async () => {
      const result = await utils.reolsveNestedPromises(Promise.resolve(42))
      expect(result).toBe(42)
    })

    test('should return non-promise values as-is', async () => {
      const result = await utils.reolsveNestedPromises(42)
      expect(result).toBe(42)
    })

    test('should resolve promises in arrays', async () => {
      const result = await utils.reolsveNestedPromises([Promise.resolve(1), Promise.resolve(2), 3])
      expect(result).toEqual([1, 2, 3])
    })

    test('should resolve promises in objects', async () => {
      const result = await utils.reolsveNestedPromises({
        a: Promise.resolve(1),
        b: Promise.resolve(2),
        c: 3,
      })
      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })

    test('should handle deeply nested promises', async () => {
      const result = await utils.reolsveNestedPromises({
        level1: {
          level2: {
            value: Promise.resolve('deep'),
          },
        },
      })
      expect(result).toEqual({ level1: { level2: { value: 'deep' } } })
    })

    test('should handle null values', async () => {
      const result = await utils.reolsveNestedPromises(Promise.resolve(null))
      expect(result).toBeNull()
    })

    test('should preserve special objects like Date', async () => {
      const now = new Date()
      const result = await utils.reolsveNestedPromises({ date: now, value: 1 })
      expect(result).toEqual({ date: now, value: 1 })
    })

    test('should handle mixed nested structures', async () => {
      const result = await utils.reolsveNestedPromises({
        arr: [Promise.resolve(1), { nested: Promise.resolve(2) }],
        obj: { arr: [Promise.resolve(3)] },
      })
      expect(result).toEqual({
        arr: [1, { nested: 2 }],
        obj: { arr: [3] },
      })
    })
  })
})
