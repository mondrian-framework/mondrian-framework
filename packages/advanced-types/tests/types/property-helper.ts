import { fc as gen, test } from '@fast-check/vitest'
import { decode, encode, m } from '@mondrian-framework/model'
import { SuiteFactory, expect } from 'vitest'

/**
 * This function can be used to test a type provided generators and arrays of valid and invalid values.
 * It will check that valid values can be decoded while invalid ones cannot.
 *
 * It also checks that the encoding and decoding process are one the inverse of the other for valid types.
 *
 * @param type the type to test
 * @param rawValidValues a generator for values that can be decoded successfully to a value of the given `type`
 * @param rawInvalidValues a generator for values that cannot be decoded to a value of the given `type`
 * @param knownValidValues an array of valid values you want to make sure are tested to pass decoding
 * @param knownInvalidValues an array of invalid values you want to make sure are tested to fail decoding
 */
export function testTypeEncodingAndDecoding<T extends m.Type>(
  type: T,
  generators: {
    validValues?: gen.Arbitrary<unknown>
    invalidValues?: gen.Arbitrary<unknown>
    knownValidValues?: unknown[]
    knownInvalidValues?: unknown[]
  },
): SuiteFactory<{}> {
  return () => {
    const { invalidValues, validValues, knownInvalidValues, knownValidValues } = generators

    if (validValues) {
      test.prop([validValues])('decoding pass for a generated valid value', async (rawValue) => {
        expect(decode(type, rawValue)).toEqual({ success: true, value: rawValue })
      })

      test.prop([validValues])('encoding and decoding are inverses for generated valid values', async (rawValue) => {
        const decoded = decode(type, rawValue)
        if (!decoded.success) {
          expect.fail('decoding a valid value should have succeded')
        }

        const encoded = encode(type, decoded.value)
        expect(encoded).toEqual(rawValue)

        const decodedAgain = decode(type, encoded)
        expect(decodedAgain).toEqual({ success: true, value: rawValue })
      })
    }

    if (knownValidValues) {
      test('decoding pass for known valid values', async () => {
        knownValidValues.forEach((rawValue) => {
          expect(decode(type, rawValue)).toEqual({ success: true, value: rawValue })
        })
      })

      test('encoding and decoding are inverses for known valid values', async () => {
        knownValidValues.forEach((rawValue) => {
          const decoded = decode(type, rawValue)
          if (!decoded.success) {
            expect.fail('decoding a valid value should have succeded')
          }

          const encoded = encode(type, decoded.value)
          expect(encoded).toEqual(rawValue)

          const decodedAgain = decode(type, encoded)
          expect(decodedAgain).toEqual({ success: true, value: rawValue })
        })
      })
    }

    if (invalidValues) {
      test.prop([invalidValues])('decoding fails for a generated invalid value', async (rawValue) => {
        if (decode(type, rawValue).success) {
          expect.fail(`${rawValue} was decoded but I expected the decoding to fail`)
        }
      })
    }

    if (knownInvalidValues) {
      test('decoding fails for known invalid values', async () => {
        knownInvalidValues.forEach((rawValue) => {
          if (decode(type, rawValue).success) {
            expect.fail(`${rawValue} was decoded but I expected the decoding to fail`)
          }
        })
      })
    }
  }
}
