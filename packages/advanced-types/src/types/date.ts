import { CustomTypeOpts, Result, m, validate } from '@mondrian-framework/model'

const RFC_3339_REGEX = /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

export function date(opts?: CustomTypeOpts & { minimum?: Date; maximum?: Date }) {
  return m.custom(
    {
      name: 'date',
      format: 'RFC 3339',
      encodedType: m.string(),
      decode: (input, options, decodeOptions) => {
        if (!RFC_3339_REGEX.test(input)) {
          return Result.error('Invalid date format [RFC 3339]', input)
        }
        const year = Number(input.substring(0, 4))
        const month = Number(input.substring(5, 2))
        const day = Number(input.substring(8, 2))

        switch (month) {
          case 2: // February
            if (leapYear(year) && day > 29) {
              return Result.error('Invalid date day', input)
            } else if (!leapYear(year) && day > 28) {
              return Result.error('Invalid date day', input)
            }
          case 4: // April
          case 6: // June
          case 9: // September
          case 11: // November
            if (day > 30) {
              return Result.error('Invalid date day', input)
            }
            break
        }
        return Result.success(new Date(input))
      },
      encode: (input) => {
        return input.toISOString().split('T')[0]
      },
      validate(input, opts) {
        return validate(m.datetime(opts), input)
      },
    },
    opts,
  )
}

const leapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}
