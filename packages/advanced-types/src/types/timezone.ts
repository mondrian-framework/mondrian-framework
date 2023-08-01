import { m } from '@mondrian-framework/model'
import { result } from '@mondrian-framework/model'

export type TimezoneType = m.CustomType<'timezone', {}, string>

export function timezone(options?: m.BaseOptions): TimezoneType {
  return m.custom(
    'timezone',
    (value) => value,
    (value) => (typeof value === 'string' ? result.success(value) : result.error('Expected a string timezone', value)),
    validateTimezone,
    options,
  )
}

function validateTimezone(value: string): result.Result<true> {
  if (!Intl?.DateTimeFormat().resolvedOptions().timeZone) {
    result.error('Time zones are not available in this environment', value)
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return result.success(true)
  } catch (ex) {
    if (ex instanceof RangeError) {
      return result.error('Invalid IANA time zone', value)
    } else {
      return result.error('Invalid time zone', value)
    }
  }
}
