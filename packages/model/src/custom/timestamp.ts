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
  _decodingOptions: decoder.Options,
  _options?: types.OptionsOf<TimestampType>,
): decoder.Result<Date> {
  if (value instanceof Date) {
    return decoder.succeed(value)
  }
  return typeof value === 'number' && -8640000000000000 <= value && value <= 8640000000000000
    ? decoder.succeed(new Date(value))
    : decoder.fail(`timestamp`, value)
}

function validateTimestamp(
  input: Date,
  _validationOptions: validator.Options,
  options?: types.OptionsOf<TimestampType>,
): validator.Result {
  if (options === undefined) {
    return validator.succeed()
  }
  const { minimum, maximum } = options
  if (maximum && input.getTime() > maximum.getTime()) {
    return validator.fail(`Timestamp must be maximum ${maximum.toISOString()}`, input)
  }
  if (minimum && input.getTime() < minimum.getTime()) {
    return validator.fail(`Timestamp must be minimum ${minimum.toISOString()}`, input)
  }
  return validator.succeed()
}
