import { types, decoding, validation } from '../index'
import gen from 'fast-check'

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
export function datetime(options?: types.OptionsOf<DateTimeType>): DateTimeType {
  return types.custom('datetime', encodeDateTime, decodeDateTime, validateDateTime, datetimeArbitrary, options)
}

function encodeDateTime(date: Date): string {
  return date.toISOString()
}

function decodeDateTime(
  value: unknown,
  decodingOptions?: decoding.Options,
  _options?: types.OptionsOf<DateTimeType>,
): decoding.Result<Date> {
  if (value instanceof Date) {
    return decoding.succeed(value)
  } else if (typeof value === 'string' && decodingOptions?.typeCastingStrategy !== 'tryCasting') {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? decoding.fail('ISO date', value) : decoding.succeed(date)
  } else if (
    (typeof value === 'number' || typeof value === 'string') &&
    decodingOptions?.typeCastingStrategy === 'tryCasting'
  ) {
    return tryMakeDate(value)
  }
  return decoding.fail('ISO date', value)
}

function tryMakeDate(value: number | string): decoding.Result<Date> {
  const time = Number(value)
  let date: Date
  if (!Number.isNaN(time)) {
    date = new Date(time)
  } else {
    date = new Date(value)
  }
  return Number.isNaN(date.valueOf()) ? decoding.fail('ISO date', value) : decoding.succeed(date)
}

function validateDateTime(
  date: Date,
  _validationOptions?: validation.Options,
  options?: types.OptionsOf<DateTimeType>,
): validation.Result {
  if (options === undefined) {
    return validation.succeed()
  }
  const { maximum, minimum } = options
  if (maximum && (Number.isNaN(date.valueOf()) || date.getTime() > maximum.getTime())) {
    return validation.fail(`Datetime must be maximum ${maximum.toISOString()}`, date)
  }
  if (minimum && (Number.isNaN(date.valueOf()) || date.getTime() < minimum.getTime())) {
    return validation.fail(`Datetime must be minimum ${minimum.toISOString()}`, date)
  }
  return validation.succeed()
}

function datetimeArbitrary(_maxDepth: number, options?: types.DateTimeOptions): gen.Arbitrary<Date> {
  return gen.date({ min: options?.minimum, max: options?.maximum })
}
