import { decoding, m, validation } from '@mondrian-framework/model'

export type TimezoneType = m.CustomType<'timezone', {}, string>

export function timezone(options?: m.BaseOptions): TimezoneType {
  return m.custom(
    'timezone',
    (value) => value,
    (value) =>
      typeof value === 'string' ? decoding.succeed(value) : decoding.fail('Expected a string timezone', value),
    validateTimezone,
    options,
  )
}

function validateTimezone(value: string): validation.Result {
  if (!Intl?.DateTimeFormat().resolvedOptions().timeZone) {
    validation.fail('Time zones are not available in this environment', value)
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return validation.succeed()
  } catch (ex) {
    if (ex instanceof RangeError) {
      return validation.fail('Invalid IANA time zone', value)
    } else {
      return validation.fail('Invalid time zone', value)
    }
  }
}
