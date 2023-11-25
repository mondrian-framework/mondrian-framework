import { decoding, model, validation } from '../..'
import gen from 'fast-check'

const DATE_REGEX = /^[+-]?(\d\d*-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

export type DateTypeAdditionalOptions = {
  minimum?: Date
  maximum?: Date
}

export type DateType = model.CustomType<'date', DateTypeAdditionalOptions, Date>

export function date(options?: model.OptionsOf<DateType>): DateType {
  return model.custom(
    'date',
    (value) => value.toISOString().split('T')[0],
    decodeDate,
    validateDate,
    dateArbitrary,
    options,
  )
}

const dayOfMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

function decodeDate(value: unknown): decoding.Result<Date> {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    return decoding.fail('Invalid date format (expected: yyyy-mm-dd)', value)
  }
  const [yearS, monthS, dayS] = value.startsWith('-') ? value.substring(1).split('-') : value.split('-')
  const [year, month, day] = [Number(yearS) * (value.startsWith('-') ? -1 : 1), Number(monthS), Number(dayS)]
  const daysOfMonth = dayOfMonths[month - 1] + (month === 2 && isLeapYear(year) ? 1 : 0)
  if (day > daysOfMonth) {
    return decoding.fail('Invalid date', value)
  }
  const date = new Date(Date.parse(value))
  return Number.isNaN(date.valueOf()) ? decoding.fail('Invalid date', value) : decoding.succeed(date)
}

function validateDate(
  value: Date,
  validationOptions?: validation.Options,
  options?: model.OptionsOf<DateType>,
): validation.Result {
  return model.datetime(options).validate(value, validationOptions)
}

function dateArbitrary(_maxDepth: number, options?: model.OptionsOf<DateType>): gen.Arbitrary<Date> {
  return gen
    .date({ min: options?.minimum, max: options?.maximum })
    .map((d) => new Date(Date.parse(d.toISOString().split('T')[0])))
}

function isLeapYear(year: number): boolean {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}
