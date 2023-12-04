import { decoding, model, validation } from '../..'
import gen from 'fast-check'

export type TimezoneType = model.CustomType<'timezone', {}, string>

export function timezone(options?: model.BaseOptions): TimezoneType {
  return model.custom({ typeName: 'timezone', encoder, decoder, validator, arbitrary, options })
}

function encoder(value: string): string {
  return value
}

function decoder(value: unknown): decoding.Result<string> {
  if (typeof value === 'string') {
    return decoding.succeed(value)
  } else {
    return decoding.fail('Expected a string timezone', value)
  }
}

function validator(value: string): validation.Result {
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

function arbitrary(): gen.Arbitrary<string> {
  return gen.constantFrom('Europe/Rome', 'europe/rome', 'europe/Rome', 'EUROPE/ROME', 'Africa/Cairo', 'America/Halifax')
}
