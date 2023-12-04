import { decoding, result, model, validation, encoding } from '../..'
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
  //TODO [Good first issue]: do costraint check like number type
  if (
    options?.decimals != null &&
    (options.decimals < 0 || options.decimals > 100 || !Number.isInteger(options.decimals))
  ) {
    throw new Error('Invalid decimals, must be and integer between 0 and 100')
  }
  return model.custom({ typeName: 'decimal', encoder, decoder, validator: buildValidator(options), arbitrary, options })
}

function encoder(
  value: BigNumber,
  _encodingOptions: Required<encoding.Options>,
  options?: model.OptionsOf<DecimalType>,
): string {
  const encoded = options?.decimals != null ? value.decimalPlaces(options.decimals) : value
  return encoded.toString(options?.base ?? 10)
}

function decoder(
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

function buildValidator(
  options?: model.OptionsOf<DecimalType>,
): (value: BigNumber, options: Required<validation.Options>) => validation.Result {
  const { maximum, minimum, exclusiveMaximum, exclusiveMinimum, multipleOf } = options ?? {}
  //prettier-ignore
  return validation.buildValidator<BigNumber>({
    ...(maximum != null ? { [`decimal must be less than or equal to ${maximum}`]: (value) => value.gt(maximum) } : {}),
    ...(minimum != null ? { [`decimal must be greater than or equal to ${minimum}`]: (value) => value.lt(minimum) } : {}),
    ...(exclusiveMaximum != null ? { [`decimal must be less than ${exclusiveMaximum}`]: (value) => value.gte(exclusiveMaximum) } : {}),
    ...(exclusiveMinimum != null ? { [`decimal must be greater than ${exclusiveMinimum}`]: (value) => value.lte(exclusiveMinimum) } : {}),
    ...(multipleOf != null ? { [`decimal must be multiple of ${multipleOf}`]: (value) => !value.mod(multipleOf).eq(0) } : {}),
  })
}

function arbitrary(_maxDepth: number, options?: model.OptionsOf<DecimalType>): gen.Arbitrary<BigNumber> {
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
