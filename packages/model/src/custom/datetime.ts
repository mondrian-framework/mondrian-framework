import { error, success } from '../result'
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
            return error('ISO date expected', input)
          }
        }
        return success(new Date(time))
      },
      encode: (input) => {
        return input.toISOString()
      },
      validate(input, options) {
        if (!(input instanceof Date)) {
          return error(`Date expected`, input)
        }
        if (options?.maximum != null && input.getTime() > options.maximum.getTime()) {
          return error(`Datetime must be maximum ${options.maximum.toISOString()}`, input)
        }
        if (options?.minimum != null && input.getTime() < options.minimum.getTime()) {
          return error(`Datetime must be minimum ${options.minimum.toISOString()}`, input)
        }
        return success(input)
      },
    },
    opts,
  )
}
