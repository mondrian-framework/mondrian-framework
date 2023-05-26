import { CustomType, custom } from '../type-system'

export type TimestampType = CustomType<Date, 'timestamp', { min?: Date; max?: Date }>
export function timestamp(opts?: TimestampType['opts']): TimestampType {
  return custom(
    {
      name: 'timestamp',
      decode: (input) => {
        if (typeof input !== 'number') {
          return { pass: false, errors: [{ path: '', value: input, error: 'Unix time expected (ms)' }] }
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
