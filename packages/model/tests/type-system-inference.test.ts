import m from '../src'
import { nonEmptyArray } from './generator-utils'
import { test, fc as gen } from '@fast-check/vitest'
import { expect, expectTypeOf, describe } from 'vitest'

describe('enumeration', () => {
  test('enum type is inferred to be a union of literal strings', () => {
    type TestEnum = m.Infer<typeof testEnum>
    const testEnum = m.enum(['type1', 'type2', 'type3'])
    expectTypeOf<TestEnum>().toEqualTypeOf<'type1' | 'type2' | 'type3'>()
  })

  test('enum type with a single case is inferred to be a literal string', () => {
    type TestEnum = m.Infer<typeof testEnum>
    const testEnum = m.enum(['type'])
    expectTypeOf<TestEnum>().toEqualTypeOf<'type'>()
  })

  test.prop([nonEmptyArray(gen.string())])(
    'enum function generates an enumeration with the given fields',
    (strings) => {
      const testEnum = m.enum(strings)
      expect(testEnum.values).toEqual(strings)
    },
  )
})
