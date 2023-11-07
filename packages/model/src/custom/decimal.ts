import { decoding, result, types, validation } from '..'
import BigNumber from 'bignumber.js'
import gen from 'fast-check'

export type DecimalTypeAdditionalOptions = {
  multipleOf?: BigNumber | number
  minimum?: BigNumber | number
  maximum?: BigNumber | number
  exclusiveMinimum?: BigNumber | number
  exclusiveMaximum?: BigNumber | number
  base?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
  decimals?: number
}

export type DecimalType = types.CustomType<'decimal', DecimalTypeAdditionalOptions, BigNumber>

export function decimal(options?: types.OptionsOf<DecimalType>): DecimalType {
  if (
    options?.decimals != null &&
    (options.decimals < 0 || options.decimals > 100 || !Number.isInteger(options.decimals))
  ) {
    throw new Error('Invalid decimals, must be and integer between 0 and 100')
  }
  return types.custom('decimal', encodeDecimal, decodeDecimal, validateDecimal, decimalArbitrary, options)
}

function encodeDecimal(value: BigNumber, options?: types.OptionsOf<DecimalType>): string {
  const encoded = options?.decimals != null ? value.decimalPlaces(options.decimals) : value
  return encoded.toString(options?.base ?? 10)
}

function decodeDecimal(
  value: unknown,
  decodingOptions?: decoding.Options,
  options?: types.OptionsOf<DecimalType>,
): decoding.Result<BigNumber> {
  if (typeof value === 'string' || typeof value === 'number') {
    const decoded = new BigNumber(value, options?.base ?? 10)
    const number = options?.decimals != null ? decoded.decimalPlaces(options?.decimals) : decoded
    if (number.isNaN()) {
      return decoding.fail(`Invalid decimal. (base ${options?.decimals ?? 10})`, value)
    }
    if (decodingOptions?.typeCastingStrategy === 'expectExactTypes' && !number.eq(decoded)) {
      return decoding.fail(
        `Invalid decimal places (need exactly ${options?.decimals}). (base ${options?.decimals ?? 10})`,
        value,
      )
    }
    return result.ok(number)
  }
  return decoding.fail(`Number or string representing a number expected. (base ${options?.decimals ?? 10})`, value)
}

function validateDecimal(
  value: BigNumber,
  _validationOptions?: validation.Options,
  options?: types.OptionsOf<DecimalType>,
): validation.Result {
  if (options?.maximum != null && value.gt(options.maximum)) {
    return validation.fail(`decimal must be less than or equal to ${options.maximum}`, value)
  }
  if (options?.minimum != null && value.lt(options.minimum)) {
    return validation.fail(`decimal must be greater than or equal to ${options.minimum}`, value)
  }
  if (options?.exclusiveMaximum != null && value.gte(options.exclusiveMaximum)) {
    return validation.fail(`decimal must be less than ${options.exclusiveMaximum}`, value)
  }
  if (options?.exclusiveMinimum != null && value.lte(options.exclusiveMinimum)) {
    return validation.fail(`decimal must be greater than ${options.exclusiveMinimum}`, value)
  }
  if (options?.multipleOf != null && !value.mod(options.multipleOf).eq(0)) {
    return validation.fail(`decimal must be multiple of ${options.multipleOf}`, value)
  }
  return validation.succeed()
}

function decimalArbitrary(_maxDepth: number, options?: types.OptionsOf<DecimalType>): gen.Arbitrary<BigNumber> {
  //TODO [Good first issue] Implementation of decimal arbitrary needed 🙏
  throw new Error('Arbitrary of `decimal` type not implemented yet!')
}
