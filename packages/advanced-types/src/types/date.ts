import { m, validate } from '@mondrian-framework/model'
import { Result, error, success } from '@mondrian-framework/model/src/result'
import { ValidationOptions } from '@mondrian-framework/model/src/validate'

const RFC_3339_REGEX = /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

export type DateTypeAdditionalOptions = {
  minimum?: Date
  maximum?: Date
}

export type DateType = m.CustomType<'date', DateTypeAdditionalOptions, Date>

export function date(options?: m.OptionsOf<DateType>): DateType {
  return m.custom('date', (value) => value.toISOString().split('T')[0], decodeDate, validateDate, options)
}

function decodeDate(value: unknown): Result<Date> {
  if (typeof value !== 'string' || !RFC_3339_REGEX.test(value)) {
    return error('Invalid date format [RFC 3339]', value)
  }
  const year = Number(value.substring(0, 4))
  const month = Number(value.substring(5, 2))
  const day = Number(value.substring(8, 2))

  switch (month) {
    case 2: // February
      if (leapYear(year) && day > 29) {
        return error('Invalid date day', value)
      } else if (!leapYear(year) && day > 28) {
        return error('Invalid date day', value)
      }
    case 4: // April
    case 6: // June
    case 9: // September
    case 11: // November
      if (day > 30) {
        return error('Invalid date day', value)
      }
      break
  }
  return success(new Date(value))
}

const leapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function validateDate(
  value: Date,
  validationOptions: ValidationOptions,
  options?: m.OptionsOf<DateType>,
): Result<true> {
  return validate(m.dateTime(options), value, validationOptions)
}
