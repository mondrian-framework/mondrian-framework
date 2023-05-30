import { CustomType, custom, string } from '../type-system'

const DateTimeEncodedType = string()
type DateTimeEncodedType = typeof DateTimeEncodedType
type DateTimeType = CustomType<Date, DateTimeEncodedType, { minimum?: Date; maximum?: Date }>
export function datetime(opts?: DateTimeType['opts']): DateTimeType {
  return custom(
    {
      name: 'datetime',
      encodedType: DateTimeEncodedType,
      decode: (input, options, decodeOptions) => {
        let time: number = Date.parse(input)
        if (Number.isNaN(time)) {
          time = Number(input)
          if (!decodeOptions?.cast || Number.isNaN(time) || time > 864000000000000 || time < -864000000000000) {
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
