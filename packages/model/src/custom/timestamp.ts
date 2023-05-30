import { error, success } from '../result'
import { CustomTypeOpts, custom, integer } from '../type-system'

export function timestamp(opts?: CustomTypeOpts & { minimum?: Date; maximum?: Date }) {
  return custom(
    {
      name: 'timestamp',
      encodedType: integer(),
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
