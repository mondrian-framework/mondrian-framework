import { types, decoding, validation } from '../index'
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
  decodingOptions?: decoding.Options,
  options?: types.OptionsOf<TimestampType>,
): decoding.Result<Date> {
  if (value instanceof Date) {
    return decoding.succeed(value)
  }
  if (decodingOptions?.typeCastingStrategy === 'tryCasting' && typeof value === 'string') {
    return decodeTimestamp(Number(value), decodingOptions, options).lazyOr(() =>
      decodeTimestamp(new Date(value).getTime(), decodingOptions, options),
    )
  }
  return typeof value === 'number' && -8640000000000000 <= value && value <= 8640000000000000
    ? decoding.succeed(new Date(value))
    : decoding.fail(`timestamp`, value)
}

function validateTimestamp(
  input: Date,
  _validationOptions?: validation.Options,
  options?: types.OptionsOf<TimestampType>,
): validation.Result {
  if (options === undefined) {
    return validation.succeed()
  }
  const { minimum, maximum } = options
  if (maximum && (Number.isNaN(input.getTime()) || input.getTime() > maximum.getTime())) {
    return validation.fail(`Timestamp must be maximum ${maximum.toISOString()}`, input)
  }
  if (minimum && (Number.isNaN(input.getTime()) || input.getTime() < minimum.getTime())) {
    return validation.fail(`Timestamp must be minimum ${minimum.toISOString()}`, input)
  }
  return validation.succeed()
}
