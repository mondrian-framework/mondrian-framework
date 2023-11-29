import { arbitrary, model } from '../src'
import { assertOk } from './testing-utils'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

const typeAndEncodedValue = arbitrary
  .modelAndValue()
  .map(([type, value]) => [type, model.concretise(type).encodeWithoutValidation(value), value] as const)

describe.concurrent('encoding', () => {
  test.prop([arbitrary.modelAndValue()])('can always encode a type and a valid value', ([type, value]) => {
    assertOk(model.concretise(type).encode(value))
  })

  test.prop([arbitrary.modelAndValue(3, 1)])(
    'can always encode a type and a valid (shallow) value',
    ([type, value]) => {
      assertOk(model.concretise(type).encode(value))
    },
  )
})

describe.concurrent(
  'encoding-decoding',
  () => {
    // A note on why the inverse is not true (that is `∃x. decoding(encoding(x)) !== x`)
    // Consider the following type: number().nullable().optional(): a valid value might be
    // `null`; however, both `null` and `undefined` are both encoded to the JSON value `null`!
    // This means that, in the decoding process, when faced with null and the above type
    // the decoded result would be undefined (and not the original null)
    test.prop([typeAndEncodedValue])('are one inverse of the other', ([type, encoded]) => {
      //encoding(decoding(x)) = x
      const concreteType = model.concretise(type)
      const decodedResult = concreteType.decode(encoded)
      const decoded = assertOk(decodedResult)
      const encodedResult = concreteType.encode(decoded as never)
      const encodedAgain = assertOk(encodedResult)
      expect(encodedAgain).toEqual(encoded)
    })
  },
  //{ repeats: 10 },
)

describe.concurrent('validation', () => {
  test.prop([arbitrary.modelAndValue()])('always succeeds on generated valid values', ([type, value]) => {
    assertOk(model.concretise(type).validate(value))
  })
})
