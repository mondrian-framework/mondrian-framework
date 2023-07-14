import { m, validate } from '@mondrian-framework/model'
import { Result, error, success } from '@mondrian-framework/model/src/result'

export function timezone(options?: m.BaseOptions): m.CustomType<'timezone', {}, string> {
  return m.custom(
    'timezone',
    (value) => value,
    (value) => (typeof value === 'string' ? success(value) : error('Expected a string timezone', value)),
    validateTimezone,
    options,
  )
}

function validateTimezone(value: string): Result<string> {
  if (!Intl?.DateTimeFormat().resolvedOptions().timeZone) {
    error('Time zones are not available in this environment', value)
  }

  const isString = validate(m.string(), value)
  if (!isString.success) {
    return isString
  }
  const inputString = isString.value
  try {
    Intl.DateTimeFormat(undefined, { timeZone: inputString })
    return success(inputString)
  } catch (ex) {
    if (ex instanceof RangeError) {
      return error('Invalid IANA time zone', value)
    } else {
      return error('Invalid time zone', value)
    }
  }
}
