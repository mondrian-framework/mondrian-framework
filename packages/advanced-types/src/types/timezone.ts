import { m } from '@mondrian-framework/model'
import { Result, error, success } from '@mondrian-framework/model'

export function timezone(options?: m.BaseOptions): m.CustomType<'timezone', {}, string> {
  return m.custom(
    'timezone',
    (value) => value,
    (value) => (typeof value === 'string' ? success(value) : error('Expected a string timezone', value)),
    validateTimezone,
    options,
  )
}

function validateTimezone(value: string): Result<true> {
  if (!Intl?.DateTimeFormat().resolvedOptions().timeZone) {
    error('Time zones are not available in this environment', value)
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return success(true)
  } catch (ex) {
    if (ex instanceof RangeError) {
      return error('Invalid IANA time zone', value)
    } else {
      return error('Invalid time zone', value)
    }
  }
}
