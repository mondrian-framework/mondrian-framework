import { model, decoding, validation } from '../../index'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * The type of a timestamp, defined as a custom type.
 */
export type TimestampType = model.CustomType<'timestamp', TimestampOptions, Date>

/**
 * Additional options for the Timestamp `CustomType`
 */
export type TimestampOptions = { minimum?: Date; maximum?: Date }

/**
 * @param options the options used to create the new timestamp custom type
 * @returns a {@link CustomType `CustomType`} representing a timestamp
 */
export function timestamp(options?: model.OptionsOf<TimestampType>): TimestampType {
  return model.custom('timestamp', encodeTimestamp, decodeTimestamp, validateTimestamp, timestampArbitrary, options)
}

function encodeTimestamp(timestamp: Date): JSONType {
  return timestamp.getTime()
}

function decodeTimestamp(
  value: unknown,
  decodingOptions: Required<decoding.Options>,
  options?: model.OptionsOf<TimestampType>,
): decoding.Result<Date> {
  if (value instanceof Date) {
    return decoding.succeed(value)
  }
  if (decodingOptions.typeCastingStrategy === 'tryCasting' && typeof value === 'string') {
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
  _validationOptions: Required<validation.Options>,
  options?: model.OptionsOf<TimestampType>,
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

function timestampArbitrary(_maxDepth: number, options?: model.TimestampOptions): gen.Arbitrary<Date> {
  return gen.date({ min: options?.minimum, max: options?.maximum })
}
