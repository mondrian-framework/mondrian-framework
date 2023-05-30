import { CustomType, decode, encode, validate, m } from '@mondrian-framework/model'

type DateType = CustomType<Date, { minimum?: Date; maximum?: Date }>
export function date(opts?: DateType['opts']) {
  return m.custom(
    {
      name: 'datetime',
      decode: (input, options, decodeOptions) => {
        export const validateDate = (datestring: string): boolean => {
          const RFC_3339_REGEX = /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

          if (!RFC_3339_REGEX.test(datestring)) {
            return false
          }

          // Verify the correct number of days for
          // the month contained in the date-string.
          const year = Number(datestring.substr(0, 4))
          const month = Number(datestring.substr(5, 2))
          const day = Number(datestring.substr(8, 2))

          switch (month) {
            case 2: // February
              if (leapYear(year) && day > 29) {
                return false
              } else if (!leapYear(year) && day > 28) {
                return false
              }
              return true
            case 4: // April
            case 6: // June
            case 9: // September
            case 11: // November
              if (day > 30) {
                return false
              }
              break
          }

          return true
        }

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
      validate(input, opts) {
        return validate(m.datetime(), input)
      },
    },
    opts,
  )
}
