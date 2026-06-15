import { arbitrary, decoding, model, path } from '../src'
import { describe, expect, test } from 'vitest'

// -----------------------------------------------------------------------------
// decoding.addExpected — `error.expected.includes(otherExpected)` truthy branch
// -----------------------------------------------------------------------------
describe('decoding.addExpected', () => {
  test('does not duplicate `expected` text when it is already included', () => {
    const error: decoding.Error = { expected: 'string or undefined', got: 1, path: path.root }
    const updated = decoding.addExpected('undefined')(error)
    expect(updated.expected).toBe('string or undefined')
  })

  test('appends to `expected` text when it is not already included', () => {
    const error: decoding.Error = { expected: 'string', got: 1, path: path.root }
    const updated = decoding.addExpected('undefined')(error)
    expect(updated.expected).toBe('string or undefined')
  })
})

// -----------------------------------------------------------------------------
// optional decoding — branch where the inner error already has `expected: 'undefined'`
// (optional.ts:68 false branch)
// -----------------------------------------------------------------------------
describe('optional decoder edge cases', () => {
  test('keeps inner error as-is when its `expected` is already exactly "undefined"', () => {
    const Model = model.optional(model.undefined())
    const result = Model.decodeWithoutValidation('not-undefined')
    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      expect(result.error[0].expected).toBe('undefined')
    }
  })

  test('nested optional adds `undefined` only once to inner expected', () => {
    const Model = model.optional(model.optional(model.string()))
    const result = Model.decodeWithoutValidation(123)
    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      // The inner optional already wrapped the error to "string or undefined"; the outer
      // optional sees `undefined` is already present and must not duplicate it.
      expect(result.error[0].expected).toBe('string or undefined')
    }
  })
})

// -----------------------------------------------------------------------------
// type-system.isTotalCountArray and type-system.unwrap
// -----------------------------------------------------------------------------
describe('type-system utilities (uncovered)', () => {
  test('isTotalCountArray returns true for arrays declared with totalCount option', () => {
    const Model = model.array(model.string(), { totalCount: true })
    expect(model.isTotalCountArray(Model)).toBe(true)
  })

  test('isTotalCountArray returns false for arrays without totalCount option', () => {
    expect(model.isTotalCountArray(model.array(model.string()))).toBe(false)
  })

  test('isTotalCountArray returns false for non-array types', () => {
    expect(model.isTotalCountArray(model.string())).toBe(false)
  })

  test('unwrap recursively strips wrappers and returns the wrapped type', () => {
    const inner = model.string()
    const wrapped = inner.optional().nullable().array()
    const unwrapped = model.unwrap(wrapped)
    expect(model.concretise(unwrapped).kind).toBe(model.Kind.String)
  })

  test('unwrap returns the input unchanged for already-bare types', () => {
    const Model = model.number()
    expect(model.unwrap(Model)).toBe(Model)
  })
})

// -----------------------------------------------------------------------------
// entity.immutable / entity.mutable — instance methods (entity.ts:84-85)
// -----------------------------------------------------------------------------
describe('entity immutable/mutable instance methods', () => {
  const fields = {
    id: model.string(),
    name: model.string(),
  }

  test('immutable entity exposes .immutable() and .mutable() helpers', () => {
    const Model = model.entity(fields)
    const asImmutable = Model.immutable()
    const asMutable = Model.mutable()
    expect(asImmutable.kind).toBe(model.Kind.Entity)
    expect(asMutable.kind).toBe(model.Kind.Entity)
    expect(asImmutable.fields).toEqual(fields)
    expect(asMutable.fields).toEqual(fields)
  })

  test('mutable entity exposes .immutable() and .mutable() helpers', () => {
    const Model = model.mutableEntity(fields)
    const asImmutable = Model.immutable()
    const asMutable = Model.mutable()
    expect(asImmutable.kind).toBe(model.Kind.Entity)
    expect(asMutable.kind).toBe(model.Kind.Entity)
    expect(asImmutable.fields).toEqual(fields)
    expect(asMutable.fields).toEqual(fields)
  })
})

// -----------------------------------------------------------------------------
// arbitrary.canGenerateValueFrom — exercises the catch branch (arbitrary.ts:708)
// -----------------------------------------------------------------------------
describe('arbitrary.canGenerateValueFrom', () => {
  test('returns true for a regular generatable type', () => {
    expect(arbitrary.canGenerateValueFrom(model.string())).toBe(true)
  })

  test('returns false for a type whose arbitrary throws (deeply recursive non-empty array)', () => {
    type Recursive = model.ArrayType<model.Mutability.Immutable, () => Recursive>
    const Recursive: () => Recursive = () => model.array(Recursive, { minItems: 1 })
    expect(arbitrary.canGenerateValueFrom(Recursive)).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// array arbitrary — `maxDepth < -100` throw guard (array.ts:215-216)
// -----------------------------------------------------------------------------
describe('array arbitrary recursion guard', () => {
  test('throws when generating values at a maxDepth below -100 for a non-empty array', () => {
    const Model = model.array(model.string(), { minItems: 1 }) as any
    expect(() => Model.arbitraryInternal(-200)).toThrow(
      'Impossible to generate an arbitrary value with the given max depth',
    )
  })
})
