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
  decodingOptions: decoder.DecodingOptions,
  _options?: types.OptionsOf<DateTimeType>,
): result.Result<Date> {
  if (typeof value === 'string' && decodingOptions.typeCastingStrategy === 'expectExactTypes') {
    return tryMakeDate(value)
  } else if (typeof value === 'number' && decodingOptions.typeCastingStrategy === 'tryCasting') {
    return tryMakeDate(value)
  }
  return result.error('ISO date expected', value)
}

function tryMakeDate(value: number | string): result.Result<Date> {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? result.error('ISO date expected', value) : result.success(date)
}

function validateDateTime(
  date: Date,
  _validationOptions: validator.ValidationOptions,
  options?: types.OptionsOf<DateTimeType>,
): result.Result<true> {
  if (options === undefined) {
    return result.success(true)
  }
  const { maximum, minimum } = options
  if (maximum && date.getTime() > maximum.getTime()) {
    return result.error(`Datetime must be maximum ${maximum.toISOString()}`, date)
  }
  if (minimum && date.getTime() < minimum.getTime()) {
    return result.error(`Datetime must be minimum ${minimum.toISOString()}`, date)
  }
  return result.success(true)
}
