import { fc as gen, test } from '@fast-check/vitest'
import { decoder, m, types } from '@mondrian-framework/model'
import { JSONType } from '@mondrian-framework/utils'
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
    knownValidValues?: readonly unknown[]
    knownInvalidValues?: readonly unknown[]
  },
  additionalOptions?: {
    skipInverseCheck?: boolean
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
      const decoded = types.concretise(type).decode(raw)
      expect(decoded.isOk).toBe(true)
      if (decoded.isOk) {
        expect(decoded.value).toEqual(expected)
      }
    }

    const checkIsNotDecoded = (rawValue: unknown) =>
      types.concretise(type).decode(rawValue).isOk
        ? expect.fail(`${rawValue} was decoded but I expected the decoding to fail`)
        : true

    // informally, we check that `encode(decode(x)) = x`
    const checkEncodeInverseOfDecode = (rawValue: unknown) => {
      const { raw } = rawValueAndExpectedValueFromUnknown(rawValue)
      const decoded = types.concretise(type).decode(raw)
      if (decoded.isOk) {
        expect(types.concretise(type).encodeWithoutValidation(decoded.value as never)).toEqual(raw)
      } else {
        // If the decoding fails I fail the test, it doesn't make sense to check for inverse in that case
        return expect.fail(
          `When checking for encode inverse of decode I was expecting to only get raw valid values but I got an invalid value: ${raw}`,
        )
      }
    }

    // informally, we check that `decode(encode(x)) = x`
    const checkDecodeInverseOfEncode = (rawValidValue: unknown) => {
      // We expect to receive as input only raw valid values. First we decode them expecting the result to be valid
      const { raw } = rawValueAndExpectedValueFromUnknown(rawValidValue)

      const decodingResult = types.concretise(type).decode(raw)
      if (!decodingResult.isOk) {
        expect.fail(`I was expecting to get only valid raw values as input but got ${rawValidValue}.
        Most likely there is a bug in the \`validValues\` passed as input`)
      } else {
        // If we got a valid value `Infer<T>` we check that by encoding and decoding we get back the same result
        const validValue = decodingResult.value
        const encodedValue = types.concretise(type).encodeWithoutValidation(validValue as never)

        const decoded = types.concretise(type).decode(encodedValue)
        expect(decoded.isOk).toBe(true)
        if (decoded.isOk) {
          expect(decoded.value).toEqual(validValue)
        }
      }
    }

    if (validValues) {
      test.prop([validValues])('decoding works for a generated valid value', checkIsDecoded)

      if (!additionalOptions?.skipInverseCheck) {
        test.prop([validValues])('encode is inverse of decode for generated values', checkEncodeInverseOfDecode)
        test.prop([validValues])('decode is inverse of encode for generated values', checkDecodeInverseOfEncode)
      }
    }

    if (knownValidValues) {
      test('decoding works for known valid values', () => knownValidValues.forEach(checkIsDecoded))

      if (!additionalOptions?.skipInverseCheck) {
        test('encode is inverse of decode for known valid values', () =>
          knownValidValues.forEach(checkEncodeInverseOfDecode))
        test('decode is inverse of encode for known valid values', () =>
          knownValidValues.forEach(checkDecodeInverseOfEncode))
      }
    }

    if (invalidValues) {
      test.prop([invalidValues])('decoding fails for a generated invalid value', checkIsNotDecoded)
    }

    if (knownInvalidValues) {
      test('decoding fails for known invalid values', () => knownInvalidValues.forEach(checkIsNotDecoded))
    }
  }
}

/**
 * This function can be used to test a type by providing the expected sequence of values:
 *  raw: JSON ---[decoding]---> decoded: Infer<T> ---[encoding]---> encoded: JSON
 *
 * It's useful for testing all those types whose encode/decode process is not bijective.
 *
 * @param type the type to test
 * @param validValues an array valid raw, decoded and encoded sequence
 * @param knownInvalidValues an array of invalid values that does not pass the decode step
 */
export function testTypeDecodingAndEncoding<T extends m.Type>(
  type: T,
  {
    validValues,
    invalidValues,
  }: {
    validValues: {
      raw: JSONType
      decoded: types.Infer<T>
      encoded: JSONType
    }[]
    invalidValues: JSONType[]
  },
  decodingOptions?: Partial<decoder.Options>,
): SuiteFactory<{}> {
  return () => {
    test('decoding works for valid values', () =>
      validValues.forEach(({ raw, decoded }) => {
        const result = types.concretise(type).decode(raw, decodingOptions)
        if (result.isOk) {
          expect(result.value).toEqual(decoded)
        } else {
          expect(result.error).toEqual([])
          expect(result.isOk).toBe(true)
        }
      }))
    test('encoding works for valid values', () =>
      validValues.forEach(({ decoded, encoded }) => {
        const result = types.concretise(type).encode(decoded as never)
        if (result.isOk) {
          expect(result.value).toEqual(encoded)
        } else {
          expect(result.error).toEqual([])
          expect(result.isOk).toBe(true)
        }
      }))
    test('decoding fails for invalid values', () =>
      invalidValues.forEach((v) => {
        const result = types.concretise(type).decode(v, decodingOptions)
        if (!result.isOk) {
          expect(result.error.length).greaterThan(0)
        } else {
          expect(result.value).toEqual(result.value === null ? undefined : null)
          expect(result.isOk).toBe(false)
        }
      }))
  }
}
