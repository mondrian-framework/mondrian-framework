import { CustomTypeOpts, Result, m, validate } from '@mondrian-framework/model'

export function timezone(opts?: CustomTypeOpts) {
  return m.custom(
    {
      name: 'timezone',
      encodedType: m.string(),
      decode: (input, opts, decodeOpts) => {
        return { success: true, value: input }
      },
      encode: (input, opts) => {
        return input
      },
      validate(input) {
        if (!Intl?.DateTimeFormat().resolvedOptions().timeZone) {
          Result.error('Time zones are not available in this environment', input)
        }

        const isString = validate(m.string(), input)
        if (!isString.success) {
          return isString
        }
        const inputString = isString.value
        try {
          Intl.DateTimeFormat(undefined, { timeZone: inputString })
          return Result.success(inputString)
        } catch (ex) {
          if (ex instanceof RangeError) {
            return Result.error('Invalid IANA time zone', input)
          } else {
            return Result.error('Invalid time zone', input)
          }
        }
      },
    },
    opts,
  )
}
