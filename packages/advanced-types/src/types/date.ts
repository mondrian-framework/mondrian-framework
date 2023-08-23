import { m, validation, decoding } from '@mondrian-framework/model'

const DATE_REGEX = /^[+-]?(\d\d*-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

export type DateTypeAdditionalOptions = {
  minimum?: Date
  maximum?: Date
}

export type DateType = m.CustomType<'date', DateTypeAdditionalOptions, Date>

export function date(options?: m.OptionsOf<DateType>): DateType {
  return m.custom('date', (value) => value.toISOString().split('T')[0], decodeDate, validateDate, options)
}

function decodeDate(value: unknown): decoding.Result<Date> {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    return decoding.fail('Invalid date format (expected: yyyy-mm-dd)', value)
  }
  const date = new Date(Date.parse(value))
  return isNaN(date.valueOf()) ? decoding.fail('Invalid date', value) : decoding.succeed(date)
}

function validateDate(
  value: Date,
  validationOptions?: validation.Options,
  options?: m.OptionsOf<DateType>,
): validation.Result {
  return m.dateTime(options).validate(value, validationOptions)
}
