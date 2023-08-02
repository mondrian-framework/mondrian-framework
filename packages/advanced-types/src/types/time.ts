import { validator, m, decoder } from '@mondrian-framework/model'

const TIME_REGEX =
  /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

export type TimeType = m.CustomType<'time', {}, Date>

export function time(options?: m.BaseOptions): TimeType {
  return m.custom('time', encodeTime, decodeTime, validateTime, options)
}

function encodeTime(value: Date) {
  const dateTimeString = value.toISOString()
  return dateTimeString.substring(dateTimeString.indexOf('T') + 1)
}

function decodeTime(value: unknown): decoder.Result<Date> {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    return decoder.fail('Invalid time format [RFC 3339]', value)
  }
  const currentDateString = new Date().toISOString()
  const currentDateAtGivenTime = new Date(currentDateString.substring(0, currentDateString.indexOf('T') + 1) + value)
  return decoder.succeed(new Date(currentDateAtGivenTime))
}

function validateTime(value: Date, validationOptions: validator.Options, options?: m.BaseOptions): validator.Result {
  return validator.validate(m.dateTime(options), value, validationOptions)
}
