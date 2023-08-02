import { result, types, decoder, validator } from '../index'

/**
 * The type of a datetime, defined as a custom type.
 */
export type DateTimeType = types.CustomType<'datetime', DateTimeOptions, Date>

/**
 * Additional options for the DateTime CustomType
 */
export type DateTimeOptions = { minimum?: Date; maximum?: Date }

/**
 * @param options the options used to create the new datetime custom type
 * @returns a {@link CustomType `CustomType`} representing a datetime
 */
export function dateTime(options?: types.OptionsOf<DateTimeType>): DateTimeType {
  return types.custom('datetime', encodeDateTime, decodeDateTime, validateDateTime, options)
}

function encodeDateTime(date: Date): string {
  return date.toISOString()
}

function decodeDateTime(
  value: unknown,
  decodingOptions: decoder.Options,
  _options?: types.OptionsOf<DateTimeType>,
): decoder.Result<Date> {
  if (typeof value === 'string' && decodingOptions.typeCastingStrategy === 'expectExactTypes') {
    return tryMakeDate(value)
  } else if (typeof value === 'number' && decodingOptions.typeCastingStrategy === 'tryCasting') {
    return tryMakeDate(value)
  }
  return decoder.fail('ISO date', value)
}

function tryMakeDate(value: number | string): decoder.Result<Date> {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? decoder.fail('ISO date', value) : decoder.succeed(date)
}

function validateDateTime(
  date: Date,
  _validationOptions: validator.Options,
  options?: types.OptionsOf<DateTimeType>,
): validator.Result {
  if (options === undefined) {
    return validator.succeed()
  }
  const { maximum, minimum } = options
  if (maximum && date.getTime() > maximum.getTime()) {
    return validator.baseFail(`Datetime must be maximum ${maximum.toISOString()}`, date)
  }
  if (minimum && date.getTime() < minimum.getTime()) {
    return validator.baseFail(`Datetime must be minimum ${minimum.toISOString()}`, date)
  }
  return validator.succeed()
}
