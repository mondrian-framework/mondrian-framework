import { decoder, m, validator } from '@mondrian-framework/model'
import { result } from '@mondrian-framework/model'
import BigNumber from 'bignumber.js'

export type DecimalTypeAdditionalOptions = {
  multipleOf?: BigNumber | number
  minimum?: BigNumber | number
  maximum?: BigNumber | number
  exclusiveMinimum?: BigNumber | number
  exclusiveMaximum?: BigNumber | number
  base?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
  decimals?: number
}

export type DecimalType = m.CustomType<'decimal', DecimalTypeAdditionalOptions, BigNumber>

export function decimal(options?: m.OptionsOf<DecimalType>): DecimalType {
  if (
    options?.decimals != null &&
    (options.decimals < 0 || options.decimals > 100 || !Number.isInteger(options.decimals))
  ) {
    throw new Error('Invalid decimals, must be and integer between 0 and 100')
  }
  return m.custom('decimal', encodeDecimal, decodeDecimal, validateDecimal, options)
}

function encodeDecimal(value: BigNumber, options?: m.OptionsOf<DecimalType>): string {
  const encoded = options?.decimals != null ? value.decimalPlaces(options.decimals) : value
  return encoded.toString(options?.base ?? 10)
}

function decodeDecimal(
  value: unknown,
  decodingOptions: decoder.Options,
  options?: m.OptionsOf<DecimalType>,
): decoder.Result<BigNumber> {
  if (typeof value === 'string' || typeof value === 'number') {
    const decoded = new BigNumber(value, options?.base ?? 10)
    const number = options?.decimals != null ? decoded.decimalPlaces(options?.decimals) : decoded
    if (number.isNaN()) {
      return decoder.fail(`Invalid decimal. (base ${options?.decimals ?? 10})`, value)
    }
    if (decodingOptions.typeCastingStrategy === 'expectExactTypes' && !number.eq(decoded)) {
      return decoder.fail(
        `Invalid decimal places (need exactly ${options?.decimals}). (base ${options?.decimals ?? 10})`,
        value,
      )
    }
    return result.ok(number)
  }
  return decoder.fail(`Number or string representing a number expected. (base ${options?.decimals ?? 10})`, value)
}

function validateDecimal(
  value: BigNumber,
  _validationOptions: validator.Options,
  options?: m.OptionsOf<DecimalType>,
): validator.Result {
  if (options?.maximum != null && value.gt(options.maximum)) {
    return validator.fail(`decimal must be less than or equal to ${options.maximum}`, value)
  }
  if (options?.minimum != null && value.lt(options.minimum)) {
    return validator.fail(`decimal must be greater than or equal to ${options.minimum}`, value)
  }
  if (options?.exclusiveMaximum != null && value.gte(options.exclusiveMaximum)) {
    return validator.fail(`decimal must be less than ${options.exclusiveMaximum}`, value)
  }
  if (options?.exclusiveMinimum != null && value.lte(options.exclusiveMinimum)) {
    return validator.fail(`decimal must be greater than ${options.exclusiveMinimum}`, value)
  }
  if (options?.multipleOf != null && !value.mod(options.multipleOf).eq(0)) {
    return validator.fail(`decimal must be multiple of ${options.multipleOf}`, value)
  }
  return validator.succeed()
}
