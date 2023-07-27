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

    const rawValueAndExpectedValueFromUnknown = (unknown: unknown) => {
      return typeof unknown === 'object' && unknown && 'raw' in unknown && 'expected' in unknown
        ? { raw: unknown.raw, expected: unknown.expected }
        : { raw: unknown, expected: unknown }
    }

    const checkIsDecoded = (rawValue: unknown) => {
      // If the decoded value is not the same as the raw value (e.g. in Time where the raw can be a string
      // and the decoded is a Date)
      const { raw, expected } = rawValueAndExpectedValueFromUnknown(rawValue)
      expect(decode(type, raw)).toEqual({ success: true, value: expected })
    }

    const checkIsNotDecoded = (rawValue: unknown) =>
      decode(type, rawValue).success ? expect.fail(`${rawValue} was decoded but I expected the decoding to fail`) : true

    // informally, we check that `decode(encode(x)) = x`
    const checkEncodeInverseOfDecode = (rawValue: unknown) => {
      const decoded = decode(type, rawValue)
      if (decoded.success) {
        expect(encode(type, decoded.value)).toEqual(rawValue)
      } else {
        // If the decoding fails I skip the test, it doesn't make sense to check for inverse in that case
        return true
      }
    }

    // informally, we check that `encode(decode(x)) = x`
    const checkDecodeInverseOfEncode = (rawValidValue: unknown) => {
      // We expect to receive as input only raw valid values. First we decode them expecting the result to be valid
      const { raw } = rawValueAndExpectedValueFromUnknown(rawValidValue)

      const decodingResult = decode(type, raw)
      if (!decodingResult.success) {
        expect.fail(`I was expecting to get only valid raw values as input but got ${rawValidValue}.
        Most likely there is a bug in the \`validValues\` passed as input`)
      } else {
        // If we got a valid value `Infer<T>` we check that by encoding and decoding we get back the same result
        const validValue = decodingResult.value
        const encodedValue = encode(type, validValue)
        expect(decode(type, encodedValue)).toEqual({ success: true, value: validValue })
      }
    }

    if (validValues) {
      test.prop([validValues])('decoding works for a generated valid value', checkIsDecoded)
      test.prop([validValues])('encode is inverse of decode for generated values', checkEncodeInverseOfDecode)
      test.prop([validValues])('decode is inverse of encode for generated values', checkDecodeInverseOfEncode)
    }

    if (knownValidValues) {
      test('decoding works for known valid values', () => knownValidValues.forEach(checkIsDecoded))
      test('encode is inverse of decode for known valid values', () =>
        knownValidValues.forEach(checkEncodeInverseOfDecode))
      test('decode is inverse of encode for known valid values', () =>
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
