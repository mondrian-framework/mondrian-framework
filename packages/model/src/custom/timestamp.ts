import { CustomType, custom } from '../type-system'

export type TimestampType = CustomType<Date, { minimum?: Date; maximum?: Date }>
export function timestamp(opts?: TimestampType['opts']): TimestampType {
  return custom(
    {
      name: 'timestamp',
      decode: (input, options) => {
        if (typeof input !== 'number') {
          return { success: false, errors: [{ value: input, error: 'Unix time expected (ms)' }] }
        }
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
