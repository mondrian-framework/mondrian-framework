import { path } from '../src'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

describe('path.empty', () => {
  test('returns empty path', () => expect(path.empty().toArray()).toEqual([]))
})

describe('path.fromFragments', () => {
  test('creates a path with the given fragments', () => {
    const fragments: path.Fragment[] = [
      { kind: path.FragmentKind.Index, index: 1 },
      { kind: path.FragmentKind.Field, fieldName: 'f' },
      { kind: path.FragmentKind.Variant, variantName: 'v' },
    ]
    expect(path.fromFragments(fragments).toArray()).toEqual(fragments)
  })
})

describe('path.prependField', () => {
  test('prepends the given field', () => {
    const fragments = path.empty().prependField('second').prependField('first').toArray()
    expect(fragments).toEqual([
      { kind: path.FragmentKind.Field, fieldName: 'first' },
      { kind: path.FragmentKind.Field, fieldName: 'second' },
    ])
  })

  test("doesn't change the original path", () => {
    const p1 = path.empty()
    const p2 = p1.prependField('field')
    expect(p1.toArray()).not.toEqual(p2.toArray())
  })
})

describe('path.appendField', () => {
  test('appends the given field', () => {
    const fragments = path.empty().appendField('first').appendField('second').toArray()
    expect(fragments).toEqual([
      { kind: path.FragmentKind.Field, fieldName: 'first' },
      { kind: path.FragmentKind.Field, fieldName: 'second' },
    ])
  })

  test("doesn't change the original path", () => {
    const p1 = path.empty()
    const p2 = p1.appendField('field')
    expect(p1.toArray()).not.toEqual(p2.toArray())
  })
})

describe('path.prependIndex', () => {
  test('prepends the given index', () => {
    const fragments = path.empty().prependIndex(2).prependIndex(1).toArray()
    expect(fragments).toEqual([
      { kind: path.FragmentKind.Index, index: 1 },
      { kind: path.FragmentKind.Index, index: 2 },
    ])
  })

  test("doesn't change the original path", () => {
    const p1 = path.empty()
    const p2 = p1.prependIndex(1)
    expect(p1.toArray()).not.toEqual(p2.toArray())
  })
})

describe('path.appendIndex', () => {
  test('appends the given index', () => {
    const fragments = path.empty().appendIndex(1).appendIndex(2).toArray()
    expect(fragments).toEqual([
      { kind: path.FragmentKind.Index, index: 1 },
      { kind: path.FragmentKind.Index, index: 2 },
    ])
  })

  test("doesn't change the original path", () => {
    const p1 = path.empty()
    const p2 = p1.appendIndex(1)
    expect(p1.toArray()).not.toEqual(p2.toArray())
  })
})

describe('path.prependVariant', () => {
  test('prepends the given variant', () => {
    const fragments = path.empty().prependVariant('second').prependVariant('first').toArray()
    expect(fragments).toEqual([
      { kind: path.FragmentKind.Variant, variantName: 'first' },
      { kind: path.FragmentKind.Variant, variantName: 'second' },
    ])
  })

  test("doesn't change the original path", () => {
    const p1 = path.empty()
    const p2 = p1.prependVariant('variant')
    expect(p1.toArray()).not.toEqual(p2.toArray())
  })
})

describe('path.appendVariant', () => {
  test('appends the given variant', () => {
    const fragments = path.empty().appendVariant('first').appendVariant('second').toArray()
    expect(fragments).toEqual([
      { kind: path.FragmentKind.Variant, variantName: 'first' },
      { kind: path.FragmentKind.Variant, variantName: 'second' },
    ])
  })

  test("doesn't change the original path", () => {
    const p1 = path.empty()
    const p2 = p1.appendVariant('variant')
    expect(p1.toArray()).not.toEqual(p2.toArray())
  })
})

describe('path.format', () => {
  test('prints $ for the empty path', () => {
    expect(path.empty().format()).toEqual('$')
  })

  test('separates object fields with .', () => {
    const pretty = path.empty().prependField('field').format()
    expect(pretty).toEqual('$.field')
  })

  test('separates variants with .', () => {
    const pretty = path.empty().prependVariant('variant').format()
    expect(pretty).toEqual('$.variant')
  })

  test('surrounds indices with square brackets', () => {
    const pretty = path.empty().prependIndex(1).format()
    expect(pretty).toEqual('$[1]')
  })

  test('works on longer paths', () => {
    const pretty1 = path.empty().prependField('inner').prependIndex(1).prependVariant('variant').format()
    expect(pretty1).toEqual('$.variant[1].inner')

    const pretty2 = path.empty().prependField('field').prependVariant('variant').prependIndex(4).format()
    expect(pretty2).toEqual('$[4].variant.field')

    const pretty3 = path.empty().prependVariant('inner').prependIndex(1).prependField('field').format()
    expect(pretty3).toEqual('$.field[1].inner')
  })
})

describe('path.equals', () => {
  test('is true for paths with same fragments', () => {
    const one = path.empty().prependField('inner').prependIndex(1).prependVariant('variant')
    const other = path.empty().prependField('inner').prependIndex(1).prependVariant('variant')
    expect(one.equals(other)).toBe(true)
  })

  test('is false for paths with different fragments', () => {
    const one = path.empty().prependField('inner').prependIndex(1).prependVariant('variant')
    const other = path.empty().prependIndex(1).prependField('inner').prependVariant('variant')
    expect(one.equals(other)).toBe(false)
  })
})
