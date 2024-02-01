import { model, decoding, validation, encoding } from '../../index'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * The type of a timestamp, defined as a custom type.
 */
export type TimestampType = model.CustomType<'timestamp', TimestampOptions, Date>

/**
 * Additional options for the Timestamp `CustomType`
 */
export type TimestampOptions = {
  minimum?: Date
  maximum?: Date
  format?: 'seconds' | 'milliseconds'
}

/**
 * @param options the options used to create the new timestamp custom type
 * @returns a {@link CustomType `CustomType`} representing a timestamp
 */
export function timestamp(options?: model.OptionsOf<TimestampType>): TimestampType {
  return model.custom({ typeName: 'timestamp', encoder, decoder, validator, arbitrary, options })
}

function formatToFactor(options?: TimestampOptions): number {
  switch (options?.format) {
    case 'seconds':
      return 1000
    case 'milliseconds':
      return 1
    default:
      return 1
  }
}

function encoder(timestamp: Date, _: encoding.Options, options?: model.OptionsOf<TimestampType>): JSONType {
  const factor = formatToFactor(options)
  return timestamp.getTime() / factor
}

function decoder(
  value: unknown,
  decodingOptions: Required<decoding.Options>,
  options?: model.OptionsOf<TimestampType>,
): decoding.Result<Date> {
  if (value instanceof Date) {
    return decoding.succeed(value)
  }
  if (decodingOptions.typeCastingStrategy === 'tryCasting' && typeof value === 'string') {
    return decoder(Number(value), decodingOptions, options).lazyOr(() =>
      decoder(new Date(value).getTime(), decodingOptions, options),
    )
  }
  const factor = formatToFactor(options)
  return typeof value === 'number' && -8640000000000000 <= value * factor && value * factor <= 8640000000000000
    ? decoding.succeed(new Date(value * factor))
    : decoding.fail(`timestamp`, value)
}

function validator(
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

function arbitrary(_maxDepth: number, options?: model.TimestampOptions): gen.Arbitrary<Date> {
  return gen.date({ min: options?.minimum, max: options?.maximum })
}
