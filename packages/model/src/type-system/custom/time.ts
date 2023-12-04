import { decoding, model, validation } from '../..'
import gen from 'fast-check'

const TIME_REGEX =
  /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

export type TimeType = model.CustomType<'time', {}, Date>

export function time(options?: model.BaseOptions): TimeType {
  return model.custom({ typeName: 'time', encoder, decoder, validator, arbitrary, options })
}

function encoder(value: Date) {
  const datetimeString = value.toISOString()
  return datetimeString.substring(datetimeString.indexOf('T') + 1)
}

function decoder(value: unknown): decoding.Result<Date> {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    return decoding.fail('Invalid time format [RFC 3339]', value)
  }
  const currentDateString = new Date(Date.UTC(0, 0, 0)).toISOString()
  const currentDateAtGivenTime = new Date(currentDateString.substring(0, currentDateString.indexOf('T') + 1) + value)
  return decoding.succeed(new Date(currentDateAtGivenTime))
}

function validator(
  value: Date,
  validationOptions: Required<validation.Options>,
  options?: model.BaseOptions,
): validation.Result {
  return model.datetime(options).validate(value, validationOptions)
}

function arbitrary(_maxDepth: number, options?: model.OptionsOf<TimeType>): gen.Arbitrary<Date> {
  return gen.date().map((t) => {
    const datetimeString = t.toISOString()
    const timeStr = datetimeString.substring(datetimeString.indexOf('T') + 1)
    const currentDateString = new Date(Date.UTC(0, 0, 0)).toISOString()
    const currentDateAtGivenTime = new Date(
      currentDateString.substring(0, currentDateString.indexOf('T') + 1) + timeStr,
    )
    return new Date(currentDateAtGivenTime)
  })
}
