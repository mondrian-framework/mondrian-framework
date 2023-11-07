import { decoding, types, validation } from '..'
import gen from 'fast-check'

const TIME_REGEX =
  /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

export type TimeType = types.CustomType<'time', {}, Date>

export function time(options?: types.BaseOptions): TimeType {
  return types.custom('time', encodeTime, decodeTime, validateTime, timeArbitrary, options)
}

function encodeTime(value: Date) {
  const dateTimeString = value.toISOString()
  return dateTimeString.substring(dateTimeString.indexOf('T') + 1)
}

function decodeTime(value: unknown): decoding.Result<Date> {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    return decoding.fail('Invalid time format [RFC 3339]', value)
  }
  const currentDateString = new Date(Date.UTC(0, 0, 0)).toISOString()
  const currentDateAtGivenTime = new Date(currentDateString.substring(0, currentDateString.indexOf('T') + 1) + value)
  return decoding.succeed(new Date(currentDateAtGivenTime))
}

function validateTime(
  value: Date,
  validationOptions?: validation.Options,
  options?: types.BaseOptions,
): validation.Result {
  return types.dateTime(options).validate(value, validationOptions)
}

function timeArbitrary(_maxDepth: number, options?: types.OptionsOf<TimeType>): gen.Arbitrary<Date> {
  return gen.date().map((t) => {
    const dateTimeString = t.toISOString()
    const timeStr = dateTimeString.substring(dateTimeString.indexOf('T') + 1)
    const currentDateString = new Date(Date.UTC(0, 0, 0)).toISOString()
    const currentDateAtGivenTime = new Date(
      currentDateString.substring(0, currentDateString.indexOf('T') + 1) + timeStr,
    )
    return new Date(currentDateAtGivenTime)
  })
}
