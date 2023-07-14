import { validate, m } from '@mondrian-framework/model'
import { error, success, Result } from '@mondrian-framework/model/src/result'
import { ValidationOptions } from '@mondrian-framework/model/src/validate'

const TIME_REGEX =
  /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

export function time(options?: m.BaseOptions): m.CustomType<'time', {}, Date> {
  return m.custom('time', encodeTime, decodeTime, validateTime, options)
}

function encodeTime(value: Date) {
  const dateTimeString = value.toISOString()
  return dateTimeString.substring(dateTimeString.indexOf('T') + 1)
}

function decodeTime(value: unknown): Result<Date> {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    return error('Invalid time format [RFC 3339]', value)
  }
  const currentDateString = new Date().toISOString()
  const currentDateAtGivenTime = new Date(currentDateString.substring(0, currentDateString.indexOf('T') + 1) + value)
  return success(new Date(currentDateAtGivenTime))
}

function validateTime(value: Date, validationOptions: ValidationOptions, options?: m.BaseOptions): Result<true> {
  return validate(m.dateTime(options), value, validationOptions)
}
