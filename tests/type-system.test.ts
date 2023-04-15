import { assert, describe, expect, it } from 'vitest'
import m from '../src/mondrian'

describe('type-system', () => {
  it('object type', () => {
    const MyType = m.object({
      a: m.number(),
      b: m.string(),
      c: m.optional(m.string()),
      d: m.optional(m.array(m.union([m.string(), m.number()]))),
      e: m.optional(m.literal(['A', 'B'])),
      f: m.optional(m.scalars.timestamp)
    })
    parseTrue(MyType, { a: 123, b: '', f: new Date() })
    parseTrue(MyType, { a: 123, b: '', f: new Date().getTime() })
    parseFalse(MyType, { a: 123, b: '', c: '', d: [1, 2, '3'], f: true })
    parseTrue(MyType, { a: 123, b: '', z: 123 })
    parseFalse(MyType, { a: 123, b: '', c: '', d: [1, 2, '3'], e: 'D' })
    parseFalse(MyType, { a: 123, b: '', c: '', d: [1, 2, '3', true, '4'] })
    parseFalse(MyType, { a: 123, b: '', c: 123 })
    parseFalse(MyType, { a: 123 })
    parseFalse(MyType, '1234')
  })
})

function parseFalse(type: m.LazyType, value: unknown) {
  const result = m.parse<any>(type, value)
  expect(result.pass).to.be.false
}

function parseTrue(type: m.LazyType, value: unknown) {
  const result = m.parse<any>(type, value)
  expect(result.pass).to.be.true
}
