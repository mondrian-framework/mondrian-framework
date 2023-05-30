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
          return {
            success: false,
            errors: [
              {
                value: input,
                error: `Timestamp must be between -864000000000000 and 864000000000000`,
              },
            ],
          }
        }
        return { success: true, value: new Date(input) }
      },
      encode: (input) => {
        return input.getTime()
      },
      validate(input, options) {
        if (!(input instanceof Date)) {
          return { success: false, errors: [{ value: input, error: `Date epected` }] }
        }
        if (options?.maximum != null && input.getTime() > options.maximum.getTime()) {
          return {
            success: false,
            errors: [{ value: input, error: `Timestamp must be maximum ${options.maximum.toISOString()}` }],
          }
        }
        if (options?.minimum != null && input.getTime() < options.minimum.getTime()) {
          return {
            success: false,
            errors: [{ value: input, error: `Timestamp must be minimum ${options.minimum.toISOString()}` }],
          }
        }
        return { success: true }
      },
    },
    opts,
  )
}
