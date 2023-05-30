import { validate, m, Result, CustomTypeOpts } from '@mondrian-framework/model'

const TIME_REGEX =
  /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

export function time(opts?: CustomTypeOpts) {
  return m.custom(
    {
      name: 'time',
      encodedType: m.string(),
      decode: (input, options, decodeOptions) => {
        if (!TIME_REGEX.test(input)) {
          return Result.error('Invalid time format [RFC 3339]', input)
        }
        const currentDateString = new Date().toISOString()
        const currentDateAtGivenTime = new Date(
          currentDateString.substring(0, currentDateString.indexOf('T') + 1) + input,
        )
        return Result.success(new Date(currentDateAtGivenTime))
      },
      encode: (input) => {
        const dateTimeString = input.toISOString()
        return dateTimeString.substring(dateTimeString.indexOf('T') + 1)
      },
      validate(input, opts) {
        return validate(m.datetime(opts), input)
      },
    },
    opts,
  )
}
