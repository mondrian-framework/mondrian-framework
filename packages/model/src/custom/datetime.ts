import { CustomType, custom } from '../type-system'

type DateTimeType = CustomType<Date, { minimum?: Date; maximum?: Date }>
export function datetime(opts?: DateTimeType['opts']): DateTimeType {
  return custom(
    {
      name: 'datetime',
      decode: (input, options, decodeOptions) => {
        let time: number = Date.parse(typeof input === 'string' ? input : '')
        if (Number.isNaN(time)) {
          if (
            decodeOptions?.cast &&
            typeof input === 'number' &&
            !Number.isNaN(input) &&
            input <= 864000000000000 &&
            input >= -864000000000000
          ) {
            time = input //try to cast from unix time ms
          } else {
            return { success: false, errors: [{ value: input, error: 'ISO date expected' }] }
          }
        }
        return { success: true, value: new Date(time) }
      },
      encode: (input) => {
        return input.toISOString()
      },
      validate(input, options) {
        if (!(input instanceof Date)) {
          return { success: false, errors: [{ value: input, error: `Date expected` }] }
        }
        if (options?.maximum != null && input.getTime() > options.maximum.getTime()) {
          return {
            success: false,
            errors: [{ value: input, error: `Datetime must be maximum ${options.maximum.toISOString()}` }],
          }
        }
        if (options?.minimum != null && input.getTime() < options.minimum.getTime()) {
          return {
            success: false,
            errors: [{ value: input, error: `Datetime must be minimum ${options.minimum.toISOString()}` }],
          }
        }
        return { success: true }
      },
    },
    opts,
  )
}
