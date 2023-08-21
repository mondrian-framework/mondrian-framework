import { decoder, m, validator } from '@mondrian-framework/model'

export type TimezoneType = m.CustomType<'timezone', {}, string>

export function timezone(options?: m.BaseOptions): TimezoneType {
  return m.custom(
    'timezone',
    (value) => value,
    (value) => (typeof value === 'string' ? decoder.succeed(value) : decoder.fail('Expected a string timezone', value)),
    validateTimezone,
    options,
  )
}

function validateTimezone(value: string): validator.Result {
  if (!Intl?.DateTimeFormat().resolvedOptions().timeZone) {
    validator.fail('Time zones are not available in this environment', value)
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return validator.succeed()
  } catch (ex) {
    if (ex instanceof RangeError) {
      return validator.fail('Invalid IANA time zone', value)
    } else {
      return validator.fail('Invalid time zone', value)
    }
  }
}
