import { decoding, types, validation } from '..'
import gen from 'fast-check'

const DATE_REGEX = /^[+-]?(\d\d*-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/

export type DateTypeAdditionalOptions = {
  minimum?: Date
  maximum?: Date
}

export type DateType = types.CustomType<'date', DateTypeAdditionalOptions, Date>

export function date(options?: types.OptionsOf<DateType>): DateType {
  return types.custom(
    'date',
    (value) => value.toISOString().split('T')[0],
    decodeDate,
    validateDate,
    dateArbitrary,
    options,
  )
}

function decodeDate(value: unknown): decoding.Result<Date> {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    return decoding.fail('Invalid date format (expected: yyyy-mm-dd)', value)
  }
  const date = new Date(Date.parse(value))
  return Number.isNaN(date.valueOf()) ? decoding.fail('Invalid date', value) : decoding.succeed(date)
}

function validateDate(
  value: Date,
  validationOptions?: validation.Options,
  options?: types.OptionsOf<DateType>,
): validation.Result {
  return types.datetime(options).validate(value, validationOptions)
}

function dateArbitrary(_maxDepth: number, options?: types.OptionsOf<DateType>): gen.Arbitrary<Date> {
  return gen
    .date({ min: options?.minimum, max: options?.maximum })
    .map((d) => new Date(Date.parse(d.toISOString().split('T')[0])))
}
