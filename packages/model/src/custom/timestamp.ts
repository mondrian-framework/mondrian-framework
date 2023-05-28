import { CustomType, custom } from '../type-system'

export type TimestampType = CustomType<Date, { min?: Date; max?: Date }>
export function timestamp(opts?: TimestampType['opts']): TimestampType {
  return custom(
    {
      name: 'timestamp',
      decode: (input, settings) => {
        if (typeof input !== 'number') {
          return { pass: false, errors: [{ path: '', value: input, error: 'Unix time expected (ms)' }] }
        }
        if (input > 864000000000000 || input < -864000000000000) {
          return {
            pass: false,
            errors: [
              { path: '', value: input, error: `Timestamp must be between -864000000000000 and 864000000000000` },
            ],
          }
        }
        if (settings?.max != null && input > settings.max.getTime()) {
          return {
            pass: false,
            errors: [{ path: '', value: input, error: `Timestamp must be maximum ${settings.max.toISOString()}` }],
          }
        }
        if (settings?.min != null && input < settings.min.getTime()) {
          return {
            pass: false,
            errors: [{ path: '', value: input, error: `Timestamp must be minimum ${settings.min.toISOString()}` }],
          }
        }
        return { pass: true, value: new Date(input) }
      },
      encode: (input) => {
        return input.getTime()
      },
      is(input) {
        return input instanceof Date
      },
    },
    opts,
  )
}
