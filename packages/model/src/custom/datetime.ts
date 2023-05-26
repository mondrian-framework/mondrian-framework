import { CustomType, custom } from '../type-system'

type DateTimeType = CustomType<Date, 'datetime', { min?: Date; max?: Date }>
export function datetime(opts?: DateTimeType['opts']): DateTimeType {
  return custom(
    {
      name: 'datetime',
      decode: (input, settings, opts) => {
        let time: number = Date.parse(typeof input === 'string' ? input : '')
        if (Number.isNaN(time)) {
          if (
            opts?.cast &&
            typeof input === 'number' &&
            !Number.isNaN(input) &&
            input <= 864000000000000 &&
            input >= -864000000000000
          ) {
            time = input //try to cast from unix time ms
          } else {
            return { pass: false, errors: [{ path: '', value: input, error: 'ISO date expected' }] }
          }
        }

        if (settings?.max != null && time > settings.max.getTime()) {
          return {
            pass: false,
            errors: [{ path: '', value: input, error: `Datetime must be maximum ${settings.max.toISOString()}` }],
          }
        }
        if (settings?.min != null && time < settings.min.getTime()) {
          return {
            pass: false,
            errors: [{ path: '', value: input, error: `Datetime must be minimum ${settings.min.toISOString()}` }],
          }
        }

        return { pass: true, value: new Date(time) }
      },
      encode: (input) => {
        return input.toISOString()
      },
      is(input) {
        return input instanceof Date
      },
    },
    opts,
  )
}
