import { arbitrary, types } from '../src'
import { assertOk } from './testing-utils'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'

describe.concurrent('encoding', () => {
  test.prop([arbitrary.typeAndValue()])('can always encode a type and a valid value', ([type, value]) => {
    assertOk(types.concretise(type).encode(value))
  })

  test.prop([arbitrary.typeAndValue(3, 1)])('can always encode a type and a valid (shallow) value', ([type, value]) => {
    assertOk(types.concretise(type).encode(value))
  })

  const typeAndEncodedValue = arbitrary
    .typeAndValue()
    .map(([type, value]) => [type, types.concretise(type).encodeWithoutValidation(value)] as const)

  // A note on why the inverse is not true (that is `∃x. decoding(encoding(x)) !== x`)
  // Consider the following type: number().nullable().optional(): a valid value might be
  // `null`; however, both `null` and `undefined` are both encoded to the JSON value `null`!
  // This means that, in the decoding process, when faced with null and the above type
  // the decoded result would be undefined (and not the original null)
  test.prop([typeAndEncodedValue])('is the inverse of decoding', ([type, encoded]) => {
    //encoding(decoding(x)) = x
    const decoded = assertOk(types.concretise(type).decode(encoded))
    const encodedAgain = assertOk(types.concretise(type).encode(decoded as never))
    expect(encodedAgain).toEqual(encoded)
  })
})

describe.concurrent('validation', () => {
  test.prop([arbitrary.typeAndValue()])('always succeeds on generated valid values', ([type, value]) => {
    assertOk(types.concretise(type).validate(value))
  })
})
