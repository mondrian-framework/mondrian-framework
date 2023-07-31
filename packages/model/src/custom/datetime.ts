import { Result, error, success } from '../result'
import { CustomType, OptionsOf, custom } from '../type-system'
import { fc as gen } from '@fast-check/vitest'
import { DecodingOptions } from 'src/decoder'
import { ValidationOptions } from 'src/validate'

/**
 * The type of a datetime, defined as a custom type.
 */
export type DateTimeType = CustomType<'datetime', DateTimeOptions, Date>

/**
 * Additional options for the DateTime CustomType
 */
export type DateTimeOptions = { minimum?: Date; maximum?: Date }

/**
 * @param options the options used to create the new datetime custom type
 * @returns a {@link CustomType `CustomType`} representing a datetime
 */
export function dateTime(options?: OptionsOf<DateTimeType>): DateTimeType {
  return custom('datetime', encodeDateTime, decodeDateTime, validateDateTime, dateTimeArbitrary(options), options)
}

function encodeDateTime(date: Date): string {
  return date.toISOString()
}

function decodeDateTime(
  value: unknown,
  decodingOptions: DecodingOptions,
  _options?: OptionsOf<DateTimeType>,
): Result<Date> {
  if (typeof value === 'string' && decodingOptions.typeCastingStrategy === 'expectExactTypes') {
    return tryMakeDate(value)
  } else if (typeof value === 'number' && decodingOptions.typeCastingStrategy === 'tryCasting') {
    return tryMakeDate(value)
  }
  return error('ISO date expected', value)
}

function tryMakeDate(value: number | string): Result<Date> {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? error('ISO date expected', value) : success(date)
}

function validateDateTime(
  date: Date,
  _validationOptions: ValidationOptions,
  options?: OptionsOf<DateTimeType>,
): Result<true> {
  if (options === undefined) {
    return success(true)
  }
  const { maximum, minimum } = options
  if (maximum && date.getTime() > maximum.getTime()) {
    return error(`Datetime must be maximum ${maximum.toISOString()}`, date)
  }
  if (minimum && date.getTime() < minimum.getTime()) {
    return error(`Datetime must be minimum ${minimum.toISOString()}`, date)
  }
  return success(true)
}

function dateTimeArbitrary(options?: OptionsOf<DateTimeType>): gen.Arbitrary<Date> {
  return gen
    .integer({ min: options?.minimum?.getTime() ?? 0, max: options?.maximum?.getTime() ?? 864000000000000 })
    .map((t) => new Date(t))
}
