import { m, validator, decoder } from '@mondrian-framework/model'

const DATE_REGEX = /^[+-]?(\d\d*-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

export type DateTypeAdditionalOptions = {
  minimum?: Date
  maximum?: Date
}

export type DateType = m.CustomType<'date', DateTypeAdditionalOptions, Date>

export function date(options?: m.OptionsOf<DateType>): DateType {
  return m.custom('date', (value) => value.toISOString().split('T')[0], decodeDate, validateDate, options)
}

function decodeDate(value: unknown): decoder.Result<Date> {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    return decoder.baseFail('Invalid date format (expected: yyyy-mm-dd)', value)
  }
  const date = new Date(Date.parse(value))
  return isNaN(date.valueOf()) ? decoder.baseFail('Invalid date', value) : decoder.succeed(date)
}

function validateDate(
  value: Date,
  validationOptions: validator.Options,
  options?: m.OptionsOf<DateType>,
): validator.Result {
  return validator.validate(m.dateTime(options), value, validationOptions)
}
