import { result, types, decoder, validator } from '../index'
import { JSONType } from '@mondrian-framework/utils'

/**
 * The type of a timestamp, defined as a custom type.
 */
export type TimestampType = types.CustomType<'timestamp', TimestampOptions, Date>

/**
 * Additional options for the Timestamp `CustomType`
 */
export type TimestampOptions = { minimum?: Date; maximum?: Date }

/**
 * @param options the options used to create the new timestamp custom type
 * @returns a {@link CustomType `CustomType`} representing a timestamp
 */
export function timestamp(options?: types.OptionsOf<TimestampType>): TimestampType {
  return types.custom('timestamp', encodeTimestamp, decodeTimestamp, validateTimestamp, options)
}

function encodeTimestamp(timestamp: Date): JSONType {
  return timestamp.getTime()
}

function decodeTimestamp(
  value: unknown,
  _decodingOptions: decoder.DecodingOptions,
  _options?: types.OptionsOf<TimestampType>,
): result.Result<Date> {
  return typeof value === 'number' && -864000000000000 < value && value < 864000000000000
    ? result.success(new Date(value))
    : result.error(`Timestamp must be between -864000000000000 and 864000000000000`, value)
}

function validateTimestamp(
  input: Date,
  _validationOptions: validator.ValidationOptions,
  options?: types.OptionsOf<TimestampType>,
): result.Result<true> {
  if (options === undefined) {
    return result.success(true)
  }
  const { minimum, maximum } = options
  if (maximum && input.getTime() > maximum.getTime()) {
    return result.error(`Timestamp must be maximum ${maximum.toISOString()}`, input)
  }
  if (minimum && input.getTime() < minimum.getTime()) {
    return result.error(`Timestamp must be minimum ${minimum.toISOString()}`, input)
  }
  return result.success(true)
}
