import { error, success } from '../result'
import { CustomType, custom, integer } from '../type-system'

const TimestampEncodedType = integer()
type TimestampEncodedType = typeof TimestampEncodedType
export type TimestampType = CustomType<Date, TimestampEncodedType, { minimum?: Date; maximum?: Date }>
export function timestamp(opts?: TimestampType['opts']): TimestampType {
  return custom(
    {
      name: 'timestamp',
      encodedType: TimestampEncodedType,
      decode: (input, options) => {
        if (input > 864000000000000 || input < -864000000000000) {
          return error(`Timestamp must be between -864000000000000 and 864000000000000`, input)
        }
        return success(new Date(input))
      },
      encode: (input) => {
        return input.getTime()
      },
      validate(input, options) {
        if (!(input instanceof Date)) {
          return error(`Date epected`, input)
        }
        if (options?.maximum != null && input.getTime() > options.maximum.getTime()) {
          return error(`Timestamp must be maximum ${options.maximum.toISOString()}`, input)
        }
        if (options?.minimum != null && input.getTime() < options.minimum.getTime()) {
          return error(`Timestamp must be minimum ${options.minimum.toISOString()}`, input)
        }
        return success(input)
      },
    },
    opts,
  )
}
