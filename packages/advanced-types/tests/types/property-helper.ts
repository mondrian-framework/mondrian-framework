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

    const checkIsDecoded = (rawValue: unknown) => {
      expect(decode(type, rawValue)).toEqual({ success: true, value: rawValue })
    }
    const checkIsNotDecoded = (rawValue: unknown) =>
      decode(type, rawValue).success ? expect.fail(`${rawValue} was decoded but I expected the decoding to fail`) : true

    // informally, we check that `decode(encode(x)) = x`
    const checkEncodeInverseOfDecode = (rawValue: unknown) => {
      const decoded = decode(type, rawValue)
      // If the decoding fails I skip the test, it doesn't make sense to check for inverse in that case
      return decoded.success ? expect(encode(type, decoded.value)).toEqual(rawValue) : true
    }

    // informally, we check that `encode(decode(x)) = x`
    const checkDecodeInverseOfEncode = (rawValidValue: unknown) => {
      // We expect to receive as input only raw valid values. First we decode them expecting the result to be valid
      const decodingResult = decode(type, rawValidValue)
      if (!decodingResult.success) {
        expect.fail(`I was expecting to get only valid raw values as input but got ${rawValidValue}.
        Most likely there is a bug in the \`validValues\` generators passed as input`)
      } else {
        // If we got a valid value `Infer<T>` we check that by encoding and decoding we get back the same result
        const validValue = decodingResult.value
        const encodedValue = encode(type, validValue)
        expect(decode(type, encodedValue)).toEqual({ success: true, value: validValue })
      }
    }

    if (validValues) {
      test.prop([validValues])('decoding pass for a generated valid value', checkIsDecoded)
      test.prop([validValues])('encode inverse of decode for generated values', checkEncodeInverseOfDecode)
      test.prop([validValues])('decode inverse of encode for generated values', checkDecodeInverseOfEncode)
    }

    if (knownValidValues) {
      test('decoding pass for known valid values', () => knownValidValues.forEach(checkIsDecoded))
      test('encode inverse of decode for known valid values', () =>
        knownValidValues.forEach(checkEncodeInverseOfDecode))
      test('decode inverse of encode for known valid values', () =>
        knownValidValues.forEach(checkDecodeInverseOfEncode))
    }

    if (invalidValues) {
      test.prop([invalidValues])('decoding fails for a generated invalid value', checkIsNotDecoded)
    }

    if (knownInvalidValues) {
      test('decoding fails for known invalid values', () => knownInvalidValues.forEach(checkIsNotDecoded))
    }
  }
}
