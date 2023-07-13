import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const PHONE_NUMBER_REGEX = /^\+[1-9]\d{6,14}$/

export function phoneNumber(options?: m.BaseOptions): m.CustomType<'phone-number', {}, string> {
  return fromRegexes(
    'phone-number',
    'Invalid phone number of the form (7-15 digits) [E.164]',
    options,
    PHONE_NUMBER_REGEX,
  )
}
