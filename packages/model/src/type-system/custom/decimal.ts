import { decoding, result, model, validation } from '../..'
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

export type DecimalType = model.CustomType<'decimal', DecimalTypeAdditionalOptions, BigNumber>

export function decimal(options?: model.OptionsOf<DecimalType>): DecimalType {
  if (
    options?.decimals != null &&
    (options.decimals < 0 || options.decimals > 100 || !Number.isInteger(options.decimals))
  ) {
    throw new Error('Invalid decimals, must be and integer between 0 and 100')
  }
  //TODO [Good first issue]: do costraint check like number type
  return model.custom('decimal', encodeDecimal, decodeDecimal, validateDecimal, decimalArbitrary, options)
}

function encodeDecimal(value: BigNumber, options?: model.OptionsOf<DecimalType>): string {
  const encoded = options?.decimals != null ? value.decimalPlaces(options.decimals) : value
  return encoded.toString(options?.base ?? 10)
}

function decodeDecimal(
  value: unknown,
  decodingOptions: Required<decoding.Options>,
  options?: model.OptionsOf<DecimalType>,
): decoding.Result<BigNumber> {
  if (typeof value === 'string' || typeof value === 'number') {
    const decoded = new BigNumber(value, options?.base ?? 10)
    const number = options?.decimals != null ? decoded.decimalPlaces(options?.decimals) : decoded
    if (number.isNaN()) {
      return decoding.fail(`Invalid decimal. (base ${options?.decimals ?? 10})`, value)
    }
    if (decodingOptions.typeCastingStrategy === 'expectExactTypes' && !number.eq(decoded)) {
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
  _validationOptions: Required<validation.Options>,
  options?: model.OptionsOf<DecimalType>,
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

function decimalArbitrary(_maxDepth: number, options?: model.OptionsOf<DecimalType>): gen.Arbitrary<BigNumber> {
  //this is a dummy implementation
  return gen
    .tuple(
      gen.constant(options?.minimum),
      gen.constant(options?.maximum),
      gen.constant(options?.exclusiveMinimum),
      gen.constant(options?.exclusiveMaximum),
    )
    .map((possibleValues) => {
      const nonNull = possibleValues.find((v) => v != null)
      if (nonNull == null) {
        return new BigNumber(0)
      } else if (typeof nonNull === 'number') {
        return new BigNumber(nonNull, options?.base)
      } else {
        return nonNull
      }
    })

  //TODO [Good first issue]: Implementation of decimal arbitrary needed 🙏
}
